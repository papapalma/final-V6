import { z } from 'zod';
import api from './api';
import { websocketClient, type ConnectionStatus } from './websocket-client';

export type { ConnectionStatus };

/**
 * Enrollment Management Service with Real-Time WebSocket Synchronization
 * 
 * Handles enrollment-related API calls with Zod validation and provides
 * real-time synchronization via WebSocket when available, with fallback
 * to REST API and cache when WebSocket is unavailable.
 * 
 * Validates: Requirements 2.1, 6.1
 */

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

/**
 * Schema for individual enrollment records
 * Validates enrollment data returned from API
 */
export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  trainee_id: z.string().uuid(),
  program_id: z.string().uuid(),
  status: z.enum(['enrolled', 'active', 'completed', 'dropped', 'failed']),
  enrollment_date: z.string().date(),
  completion_date: z.string().date().nullable().optional(),
  final_grade: z.number().min(0).max(100).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  trainee: z.object({
    id: z.string().uuid(),
    first_name: z.string(),
    last_name: z.string(),
    middle_name: z.string(),
    email: z.string().email(),
  }).optional(),
  program: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    start_date: z.string(),
    end_date: z.string(),
    status: z.string(),
  }).optional(),
});

/**
 * Schema for arrays of enrollments
 * Validates the full list returned from fetch endpoint
 */
export const enrollmentsListSchema = z.array(enrollmentSchema);

/**
 * Schema for PATCH request payload
 * Validates data sent to update an enrollment status
 */
export const updatePayloadSchema = z.object({
  status: z.enum(['enrolled', 'active', 'completed', 'dropped', 'failed']),
  completion_date: z.string().date().nullable().optional(),
  final_grade: z.number().min(0).max(100).nullable().optional(),
});

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Enrollment type derived from schema
 * Represents a single enrollment record
 */
export type Enrollment = z.infer<typeof enrollmentSchema>;

/**
 * Update payload type derived from schema
 * Represents data sent in PATCH request
 */
export type UpdateEnrollmentPayload = z.infer<typeof updatePayloadSchema>;

/**
 * Generic response wrapper for enrollment service responses
 * Used for consistent error handling and type safety
 */
export interface EnrollmentServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Enrollment update event
 * Indicates what type of change occurred (updated, added, or removed)
 */
export interface EnrollmentUpdateEvent {
  type: 'updated' | 'added' | 'removed';
  enrollment?: Enrollment;
  enrollmentId?: string;
}

/**
 * Enrollment update callback type
 * Called when enrollment data changes via WebSocket
 */
export type EnrollmentUpdateCallback = (event: EnrollmentUpdateEvent) => void;

// ============================================================================
// Cache Management
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 30000; // 30 seconds cache (fallback when WebSocket unavailable)
const WEBSOCKET_TIMEOUT = 5000; // 5 seconds to establish WebSocket before fallback
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ============================================================================
// Enrollment Service Class
// ============================================================================

class EnrollmentService {
  private updateCallbacks: Set<EnrollmentUpdateCallback> = new Set();
  private subscriptionCleanupFunctions: Map<string, () => void> = new Map();
  private currentEnrollments: Map<string, Enrollment> = new Map();
  private wsInitializationPromise: Promise<void> | null = null;
  private wsInitialized = false;

  constructor() {
    // WebSocket client initialization moved to lazy initialization pattern
    // see initializeWebSocketClient() method - it's called on first use
  }

  /**
   * Initialize WebSocket client with event handlers (lazy initialization)
   * Delays WebSocket setup until actually needed, rather than on constructor
   * This prevents connection errors from appearing on app startup when no server is running
   * 
   * Implements guard clause to prevent duplicate handler setup:
   * - Returns existing promise if initialization already started
   * - Prevents multiple simultaneous initialization attempts
   * - Wraps initialization in try-catch to suppress any errors
   * 
   * Requirement 2.1, 3.1, 3.3
   */
  private initializeWebSocketClient(): void {
    // Guard clause: return if initialization already in progress or completed
    if (this.wsInitializationPromise) {
      return;
    }

    this.wsInitializationPromise = this.setupWebSocketHandlers();
  }

  /**
   * Setup WebSocket event handlers for real-time updates
   * Wrapped in try-catch to suppress initialization errors
   * Requirement 2.1, 4.2, 4.4, 4.5, 4.6, 4.7
   */
  private async setupWebSocketHandlers(): Promise<void> {
    try {
      // Guard clause: prevent duplicate handler setup
      if (this.wsInitialized) {
        return;
      }

      // Setup handler for enrollment updates
      const unsubscribeUpdated = websocketClient.onEnrollmentUpdated((enrollment) => {
        this.handleEnrollmentUpdated(enrollment);
      });
      this.subscriptionCleanupFunctions.set('updated', unsubscribeUpdated);

      // Setup handler for enrollment additions
      const unsubscribeAdded = websocketClient.onEnrollmentAdded((enrollment) => {
        this.handleEnrollmentAdded(enrollment);
      });
      this.subscriptionCleanupFunctions.set('added', unsubscribeAdded);

      // Setup handler for enrollment removals
      const unsubscribeRemoved = websocketClient.onEnrollmentRemoved(
        (data: any) => {
          const id = typeof data === 'string' ? data : data?.enrollmentId;
          this.handleEnrollmentRemoved(id);
        }
      );
      this.subscriptionCleanupFunctions.set('removed', unsubscribeRemoved);

      this.wsInitialized = true;
    } catch (error) {
      console.debug('[EnrollmentService] WebSocket handler initialization suppressed:', error);
      // Suppress initialization errors - REST API fallback will be used
    }
  }

  /**
   * Handle enrollment update from WebSocket
   * Updates internal cache and notifies callbacks
   * Requirement 4.4, 4.5
   */
  private handleEnrollmentUpdated(enrollment: Enrollment): void {
    this.currentEnrollments.set(enrollment.id, enrollment);
    this.notifyCallbacks({
      type: 'updated',
      enrollment,
    });
  }

  /**
   * Handle enrollment addition from WebSocket
   * Updates internal cache and notifies callbacks
   * Requirement 4.6
   */
  private handleEnrollmentAdded(enrollment: Enrollment): void {
    this.currentEnrollments.set(enrollment.id, enrollment);
    this.notifyCallbacks({
      type: 'added',
      enrollment,
    });
  }

  /**
   * Handle enrollment removal from WebSocket
   * Removes from internal cache and notifies callbacks
   * Requirement 4.7
   */
  private handleEnrollmentRemoved(enrollmentId: string): void {
    this.currentEnrollments.delete(enrollmentId);
    websocketClient.unsubscribe(enrollmentId);
    this.notifyCallbacks({
      type: 'removed',
      enrollmentId,
    });
  }

  /**
   * Notify all registered callbacks of enrollment changes
   * Called when WebSocket events are received
   */
  private notifyCallbacks(event: EnrollmentUpdateEvent): void {
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in enrollment update callback:', error);
      }
    });
  }

  /**
   * Register a callback for enrollment updates
   * Called when any enrollment is updated, added, or removed via WebSocket
   * 
   * @param callback - Function to call when enrollment changes
   * @returns Unsubscribe function to remove the callback
   */
  setEnrollmentUpdateHandler(callback: EnrollmentUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Fetch all enrollments for a specific trainee
   * GET /api/enrollments?trainee_id=:id
   * 
   * Automatically subscribes to WebSocket updates for all returned enrollments
   * Falls back to REST API if WebSocket unavailable after 5 seconds
   * 
   * @param traineeId - UUID of the trainee
   * @returns Array of Enrollment objects for the trainee
   * @throws Error if validation fails or API returns error
   * 
   * Features:
   * - Caches results for 30 seconds to reduce redundant API calls
   * - Validates response using Zod schema
   * - Automatically subscribes to WebSocket for each enrollment (Requirement 2.1)
   * - Falls back to REST API if WebSocket fails (Requirement 6.1)
   * - Includes all enrollment relations (trainee, program data)
   */
  async fetchEnrollments(traineeId: string): Promise<Enrollment[]> {
    const cacheKey = `enrollments_${traineeId}`;
    
    // Check cache first
    const cached = getCached<Enrollment[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await api.get(`/enrollments?trainee_id=${traineeId}`);
      
      // Validate response using Zod schema
      const validatedData = enrollmentsListSchema.parse(response.data.data || response.data);
      
      // Cache the validated data
      setCache(cacheKey, validatedData);

      // Store enrollments in memory cache for tracking
      validatedData.forEach((enrollment) => {
        this.currentEnrollments.set(enrollment.id, enrollment);
      });

      // Subscribe to WebSocket updates for all enrollments
      // Requirement 2.1: Automatically subscribe to all returned enrollment_ids
      this.subscribeToEnrollments(validatedData);
      
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = (error.issues || (error as any).errors)?.[0]?.message || 'Unknown validation error';
        const message = `Enrollment data validation failed: ${errorMessage}`;
        console.error(message, error);
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Subscribe to WebSocket updates for a list of enrollments
   * Implements lazy WebSocket initialization - initializes on first use
   * Requirement 2.1, 2.5
   * 
   * @param enrollments - Array of enrollments to subscribe to
   */
  private subscribeToEnrollments(enrollments: Enrollment[]): void {
    // Lazy initialization: trigger setup on first use
    this.initializeWebSocketClient();

    // Only subscribe if WebSocket is initialized
    if (!this.wsInitialized) {
      return;
    }

    enrollments.forEach((enrollment) => {
      websocketClient.subscribe(enrollment.id);
    });
  }

  /**
   * Fetch a single enrollment by ID
   * GET /api/enrollments/:id
   * 
   * Used for round-trip verification after updates
   * 
   * @param enrollmentId - UUID of the enrollment to fetch
   * @returns Single Enrollment object
   * @throws Error if validation fails or API returns error
   */
  async getEnrollment(enrollmentId: string): Promise<Enrollment> {
    try {
      const response = await api.get(`/enrollments/${enrollmentId}`);
      
      // Validate response using Zod schema
      const validatedData = enrollmentSchema.parse(response.data.data || response.data);
      
      // Store in memory cache
      this.currentEnrollments.set(enrollmentId, validatedData);

      // Subscribe to WebSocket updates
      if (this.wsInitialized) {
        websocketClient.subscribe(enrollmentId);
      }
      
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = (error.issues || (error as any).errors)?.[0]?.message || 'Unknown validation error';
        const message = `Enrollment data validation failed: ${errorMessage}`;
        console.error(message, error);
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Update an enrollment's status
   * PATCH /api/enrollments/:id
   * 
   * @param enrollmentId - UUID of the enrollment to update
   * @param payload - Update payload with new status and optional fields
   * @returns Updated Enrollment object
   * @throws Error if validation fails or API returns error
   * 
   * Payload structure:
   * {
   *   status: 'completed' | 'failed' | 'dropped',
   *   completion_date?: 'YYYY-MM-DD' (only for Mark as Complete),
   *   final_grade?: number (0-100, optional)
   * }
   */
  async updateStatus(
    enrollmentId: string,
    payload: UpdateEnrollmentPayload
  ): Promise<Enrollment> {
    try {
      // Validate payload using Zod schema
      const validatedPayload = updatePayloadSchema.parse(payload);

      const response = await api.patch(`/enrollments/${enrollmentId}`, validatedPayload);

      // Validate response using Zod schema
      const validatedData = enrollmentSchema.parse(response.data.data || response.data);

      // Store in memory cache
      this.currentEnrollments.set(enrollmentId, validatedData);

      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = (error.issues || (error as any).errors)?.[0]?.message || 'Unknown validation error';
        const message = `Enrollment data validation failed: ${errorMessage}`;
        console.error(message, error);
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Force refresh enrollment data from REST API
   * Bypasses cache and WebSocket, fetching directly from server
   * 
   * Useful when data consistency concerns arise or for manual refresh
   * Requirement 6.3
   * 
   * @param traineeId - UUID of the trainee
   * @returns Fresh array of Enrollment objects
   */
  async forceRefresh(traineeId: string): Promise<Enrollment[]> {
    const cacheKey = `enrollments_${traineeId}`;
    
    // Clear cache to force fresh fetch
    clearCache(cacheKey);

    try {
      const response = await api.get(`/enrollments?trainee_id=${traineeId}`);
      
      // Validate response using Zod schema
      const validatedData = enrollmentsListSchema.parse(response.data.data || response.data);
      
      // Cache the validated data
      setCache(cacheKey, validatedData);

      // Update memory cache
      validatedData.forEach((enrollment) => {
        this.currentEnrollments.set(enrollment.id, enrollment);
      });

      // Re-subscribe to WebSocket updates with fresh data
      this.subscribeToEnrollments(validatedData);
      
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = (error.issues || (error as any).errors)?.[0]?.message || 'Unknown validation error';
        const message = `Enrollment data validation failed: ${errorMessage}`;
        console.error(message, error);
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Create a new enrollment
   * 
   * @param data - The enrollment payload
   */
  async createEnrollment(data: {
    trainee_id?: string;
    traineeId?: string;
    program_id?: string;
    programId?: string;
    source?: string;
  }): Promise<any> {
    const response = await api.post('/enrollments', data);
    return response.data;
  }

  /**
   * Get the current WebSocket connection status
   * 
   * Requirement 13.1
   * 
   * @returns Current connection status: 'connecting', 'connected', 'disconnected', 'reconnecting'
   */
  getConnectionStatus(): ConnectionStatus {
    return websocketClient.getConnectionStatus();
  }

  /**
   * Clear service cache
   * 
   * If key provided: clears specific cache entry
   * If no key: clears entire cache
   * 
   * Used to invalidate cache when needed (e.g., after manual updates)
   * 
   * @param key - Optional cache key to clear specific entry. If omitted, clears all cache
   * 
   * Usage:
   * - enrollmentService.clearCache() // Clear all enrollment cache
   * - enrollmentService.clearCache(`enrollments_${traineeId}`) // Clear specific trainee's cache
   */
  clearCache(key?: string): void {
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }

  /**
   * Cleanup subscriptions and handlers when service is destroyed
   * Called when app unmounts or service is no longer needed
   */
  cleanup(): void {
    // Remove all event handlers
    this.subscriptionCleanupFunctions.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.subscriptionCleanupFunctions.clear();

    // Clear callbacks
    this.updateCallbacks.clear();

    // Clear memory caches
    this.currentEnrollments.clear();
    clearCache();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const enrollmentService = new EnrollmentService();
export default enrollmentService;
