/**
 * WebSocket Client for Real-Time Enrollment Synchronization
 * 
 * Manages WebSocket connection to backend for receiving real-time enrollment updates.
 * Implements automatic reconnection with exponential backoff and message validation.
 * 
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 4.1, 4.3, 5.1, 5.2, 5.3, 5.4, 5.6,
 *            8.1, 8.2, 8.3, 8.4, 10.1, 10.2, 13.1, 13.2, 15.1
 */

import { z } from 'zod';
import { enrollmentSchema, Enrollment } from './enrollmentService';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * WebSocket connection status
 * - 'connecting': Initial connection attempt in progress
 * - 'connected': Successfully connected and authenticated
 * - 'disconnected': No active connection
 * - 'reconnecting': Attempting to reconnect after disconnect
 */
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/**
 * WebSocket message type enumeration
 */
type WebSocketMessageType = 
  | 'auth'
  | 'subscribe'
  | 'unsubscribe'
  | 'enrollment-updated'
  | 'enrollment-added'
  | 'enrollment-removed'
  | 'heartbeat'
  | 'pong'
  | 'subscription-ack'
  | 'error';

/**
 * WebSocket message format for client-server communication
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */
interface WebSocketMessage {
  id: string;
  type: WebSocketMessageType;
  data?: {
    token?: string;
    enrollmentId?: string;
    enrollment?: any;
    enrollmentIds?: string[];
    error?: string;
    subscribedTo?: string[];
    message?: string;
  };
  timestamp: string;
  error?: string;
}

/**
 * Event handler callback types
 */
type EnrollmentUpdatedHandler = (enrollment: Enrollment) => void;
type EnrollmentAddedHandler = (enrollment: Enrollment) => void;
type EnrollmentRemovedHandler = (enrollmentId: string) => void;
type StatusChangeHandler = (status: ConnectionStatus) => void;
type ErrorHandler = (error: Error) => void;

/**
 * Schema for validating WebSocket messages
 * Validates: Requirements 4.1, 4.3, 10.1, 10.2
 * 
 * Ensures all incoming WebSocket messages have:
 * - Valid UUID message ID
 * - Valid message type
 * - ISO8601 timestamp
 * - Optional error field for error responses
 */
const webSocketMessageSchema = z.object({
  id: z.string().uuid('Message ID must be valid UUID'),
  type: z.enum([
    'auth',
    'subscribe',
    'unsubscribe',
    'enrollment-updated',
    'enrollment-added',
    'enrollment-removed',
    'heartbeat',
    'pong',
    'subscription-ack',
    'error',
  ]),
  data: z.object({
    token: z.string().optional(),
    enrollmentId: z.string().uuid().optional(),
    enrollment: z.any().optional(),
    enrollmentIds: z.array(z.string().uuid()).optional(),
    error: z.string().optional(),
    subscribedTo: z.array(z.string().uuid()).optional(),
    message: z.string().optional(),
  }).optional(),
  timestamp: z.string().datetime({ message: 'Timestamp must be ISO8601 format' }),
  error: z.string().optional(),
});

// ============================================================================
// WebSocket Client Manager
// ============================================================================

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private status: ConnectionStatus = 'disconnected';
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  
  // Reconnection configuration
  // Validates: Requirements 5.2, 5.3, 5.4
  private readonly INITIAL_RECONNECT_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds max
  private readonly CONNECTION_TIMEOUT = 5000; // 5 seconds to establish connection

  // Event handlers
  private onEnrollmentUpdatedHandlers: EnrollmentUpdatedHandler[] = [];
  private onEnrollmentAddedHandlers: EnrollmentAddedHandler[] = [];
  private onEnrollmentRemovedHandlers: EnrollmentRemovedHandler[] = [];
  private onStatusChangeHandlers: StatusChangeHandler[] = [];
  private onErrorHandlers: ErrorHandler[] = [];

  /**
   * Establish WebSocket connection
   * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 15.1
   * 
   * Implements comprehensive error handling to suppress connection errors during development
   * when no WebSocket server is available (e.g., ws://localhost:3003 unavailable).
   * Connection failures are logged at debug level in development to avoid console spam,
   * while the application continues to function with REST API fallback.
   * 
   * DEVELOPMENT NOTE: Initial connection failures are expected and normal when no WebSocket
   * server is running. The application automatically falls back to REST API and will
   * reconnect when the server becomes available.
   * 
   * @param url - WebSocket server URL (wss:// in production, ws:// in development)
   * @param traineeId - UUID of authenticated trainee
   * @param token - JWT authentication token
   * @throws Error if connection fails (errors are suppressed at debug level)
   */
  async connect(url: string, _traineeId: string, token: string): Promise<void> {
    if (this.ws && this.status === 'connected') {
      console.debug('[WebSocket] Already connected');
      return;
    }

    this.url = url;
    this.token = token;
    this.status = 'connecting';
    this.emitStatusChange('connecting');

    return new Promise((resolve, reject) => {
      const connectionTimer = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        this.ws = null;
        this.status = 'disconnected';
        this.emitStatusChange('disconnected');
        
        const timeoutError = new Error('WebSocket connection timeout');
        console.debug('[WebSocket]', timeoutError.message);
        reject(timeoutError);
      }, this.CONNECTION_TIMEOUT);

      try {
        this.ws = new WebSocket(url);

        this.ws.addEventListener('open', () => {
          clearTimeout(connectionTimer);
          console.debug('[WebSocket] Connected, authenticating...');
          
          // Send authentication message
          this.sendMessage({
            id: this.generateMessageId(),
            type: 'auth',
            data: { token },
            timestamp: new Date().toISOString(),
          });

          // Set connection timeout for auth response
          const authTimer = setTimeout(() => {
            console.debug('[WebSocket] Authentication timeout');
            this.disconnect();
            reject(new Error('Authentication timeout'));
          }, this.CONNECTION_TIMEOUT);

          // Temporarily listen for auth-ack (subscription-ack type message in response to auth)
          const handleAuthResponse = (event: Event) => {
            const messageEvent = event as MessageEvent;
            try {
              const message = JSON.parse(messageEvent.data) as WebSocketMessage;
              
              // Auth successful if we get subscription-ack or any non-error response
              if (message.type !== 'error' && !message.error) {
                clearTimeout(authTimer);
                this.status = 'connected';
                this.reconnectAttempts = 0;
                this.emitStatusChange('connected');
                
                // Remove temporary listener and add normal ones
                if (this.ws) {
                  this.ws.removeEventListener('message', handleAuthResponse);
                  this.ws.addEventListener('message', (e) => this.handleMessage(e));
                  this.ws.addEventListener('close', () => this.handleDisconnect());
                  this.ws.addEventListener('error', (e) => this.handleError(e));
                }
                
                resolve();
              }
            } catch (error) {
              // Ignore parse errors for now
            }
          };

          if (this.ws) {
            this.ws.addEventListener('message', handleAuthResponse);
          }
        });

        this.ws.addEventListener('error', () => {
          clearTimeout(connectionTimer);
          this.status = 'disconnected';
          this.emitStatusChange('disconnected');
          
          const connectionError = new Error('WebSocket connection failed');
          console.debug('[WebSocket]', connectionError.message);
          reject(connectionError);
        });
      } catch (error) {
        clearTimeout(connectionTimer);
        this.status = 'disconnected';
        this.emitStatusChange('disconnected');
        
        const wrappedError = error instanceof Error ? error : new Error(String(error));
        console.debug('[WebSocket] Connection error:', wrappedError.message);
        reject(wrappedError);
      }
    });
  }

  /**
   * Close WebSocket connection gracefully
   * Validates: Requirements 1.6, 2.6
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.status = 'disconnected';
    this.emitStatusChange('disconnected');
  }

  /**
   * Subscribe to enrollment updates
   * Validates: Requirements 2.1, 2.2, 2.4
   * 
   * @param enrollmentId - UUID of enrollment to subscribe to
   */
  subscribe(enrollmentId: string): void {
    if (this.subscriptions.has(enrollmentId)) {
      console.debug(`[WebSocket] Already subscribed to ${enrollmentId}`);
      return;
    }

    if (this.status !== 'connected') {
      console.warn(`[WebSocket] Not connected, cannot subscribe to ${enrollmentId}`);
      return;
    }

    this.subscriptions.add(enrollmentId);
    this.sendMessage({
      id: this.generateMessageId(),
      type: 'subscribe',
      data: { enrollmentId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unsubscribe from enrollment updates
   * Validates: Requirements 2.6
   * 
   * @param enrollmentId - UUID of enrollment to unsubscribe from
   */
  unsubscribe(enrollmentId: string): void {
    if (!this.subscriptions.has(enrollmentId)) {
      console.debug(`[WebSocket] Not subscribed to ${enrollmentId}`);
      return;
    }

    this.subscriptions.delete(enrollmentId);
    
    if (this.status === 'connected') {
      this.sendMessage({
        id: this.generateMessageId(),
        type: 'unsubscribe',
        data: { enrollmentId },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current connection status
   * Validates: Requirements 13.1
   */
  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   * Validates: Requirements 13.1
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Register handler for enrollment updated events
   */
  onEnrollmentUpdated(handler: EnrollmentUpdatedHandler): () => void {
    this.onEnrollmentUpdatedHandlers.push(handler);
    return () => {
      const index = this.onEnrollmentUpdatedHandlers.indexOf(handler);
      if (index > -1) {
        this.onEnrollmentUpdatedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register handler for enrollment added events
   */
  onEnrollmentAdded(handler: EnrollmentAddedHandler): () => void {
    this.onEnrollmentAddedHandlers.push(handler);
    return () => {
      const index = this.onEnrollmentAddedHandlers.indexOf(handler);
      if (index > -1) {
        this.onEnrollmentAddedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register handler for enrollment removed events
   */
  onEnrollmentRemoved(handler: EnrollmentRemovedHandler): () => void {
    this.onEnrollmentRemovedHandlers.push(handler);
    return () => {
      const index = this.onEnrollmentRemovedHandlers.indexOf(handler);
      if (index > -1) {
        this.onEnrollmentRemovedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register handler for status change events
   */
  onStatusChange(handler: StatusChangeHandler): () => void {
    this.onStatusChangeHandlers.push(handler);
    return () => {
      const index = this.onStatusChangeHandlers.indexOf(handler);
      if (index > -1) {
        this.onStatusChangeHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register handler for error events
   */
  onError(handler: ErrorHandler): () => void {
    this.onErrorHandlers.push(handler);
    return () => {
      const index = this.onErrorHandlers.indexOf(handler);
      if (index > -1) {
        this.onErrorHandlers.splice(index, 1);
      }
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Handle incoming WebSocket messages
   * Validates: Requirements 4.1, 4.3, 8.1, 8.2, 8.3, 8.4, 10.1, 10.2
   * 
   * Process incoming WebSocket messages with strict validation:
   * 1. Parse JSON message
   * 2. Validate message structure against webSocketMessageSchema
   * 3. Dispatch to appropriate handler based on message type
   * 4. Log any validation errors without crashing
   * 5. Emit error events for validation failures
   * 
   * Gracefully handles:
   * - Malformed JSON
   * - Invalid message structure
   * - Missing required fields
   * - Invalid enrollment data
   * - Continues processing other messages even if one fails
   */
  private handleMessage(event: MessageEvent): void {
    let message: WebSocketMessage | null = null;

    try {
      // Step 1: Parse JSON from message
      message = JSON.parse(event.data) as WebSocketMessage;
    } catch (parseError) {
      const error = parseError instanceof Error ? parseError : new Error('Unknown parse error');
      console.error('[WebSocket] Failed to parse message JSON:', error.message);
      this.emitError(new Error(`Invalid WebSocket message format: ${error.message}`));
      return; // Discard unparseable message
    }

    try {
      // Step 2: Validate message structure against schema
      // This will throw if validation fails
      const validatedMessage = webSocketMessageSchema.parse(message);

      // Step 3: Dispatch to appropriate handler based on message type
      switch (validatedMessage.type) {
        case 'heartbeat':
          this.handleHeartbeat();
          break;

        case 'enrollment-updated':
          this.handleEnrollmentUpdated(validatedMessage);
          break;

        case 'enrollment-added':
          this.handleEnrollmentAdded(validatedMessage);
          break;

        case 'enrollment-removed':
          this.handleEnrollmentRemoved(validatedMessage);
          break;

        case 'error':
          console.error('[WebSocket] Server error:', validatedMessage.error);
          this.emitError(new Error(validatedMessage.error || 'Unknown server error'));
          break;

        default:
          console.debug('[WebSocket] Received message type:', validatedMessage.type);
      }
    } catch (error) {
      // Step 4: Log validation errors without crashing
      if (error instanceof z.ZodError) {
        const errors = error.issues || [];
        const validationIssues = errors
          .map((e: any) => {
            const path = Array.isArray(e.path) ? e.path.join('.') : 'unknown';
            return `${path}: ${e.message}`;
          })
          .join(', ');
        console.error('[WebSocket] Message validation failed:', validationIssues);
        console.error('[WebSocket] Invalid message content:', message);
        
        // Step 5: Emit error event for invalid messages
        this.emitError(new Error(`WebSocket message validation failed: ${validationIssues}`));
      } else {
        // Handle other unexpected errors during message handling
        console.error('[WebSocket] Unexpected error processing message:', error);
        this.emitError(error instanceof Error ? error : new Error('Unknown error processing message'));
      }
      // Continue without updating state - do not propagate error
    }
  }

  /**
   * Handle heartbeat ping from server
   * Validates: Requirements 1.5, 6.12
   */
  private handleHeartbeat(): void {
    // Send pong response within 100ms
    this.sendMessage({
      id: this.generateMessageId(),
      type: 'pong',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle enrollment updated event
   * Validates: Requirements 4.1, 4.3, 4.4, 4.5, 8.2, 10.2
   * 
   * Process enrollment-updated messages:
   * 1. Verify message has enrollment data
   * 2. Validate enrollment data against enrollmentSchema
   * 3. Log validation errors without crashing
   * 4. Notify handlers only if validation succeeds
   */
  private handleEnrollmentUpdated(message: WebSocketMessage): void {
    if (!message.data?.enrollment) {
      const errorMsg = 'Enrollment updated message missing enrollment data';
      console.warn('[WebSocket]', errorMsg);
      this.emitError(new Error(errorMsg));
      return;
    }

    try {
      // Validate enrollment data against schema
      const enrollment = enrollmentSchema.parse(message.data.enrollment);
      
      // Notify all handlers with validated enrollment
      this.onEnrollmentUpdatedHandlers.forEach((handler) => {
        try {
          handler(enrollment);
        } catch (handlerError) {
          console.error('[WebSocket] Error in enrollment updated handler:', handlerError);
          // Continue with next handler even if one throws
        }
      });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.issues || [];
        const validationIssues = errors
          .map((e: any) => {
            const path = Array.isArray(e.path) ? e.path.join('.') : 'unknown';
            return `${path}: ${e.message}`;
          })
          .join(', ');
        console.error('[WebSocket] Enrollment data validation failed on update message:', validationIssues);
        console.error('[WebSocket] Invalid enrollment:', message.data.enrollment);
        this.emitError(new Error(`Invalid enrollment data in update message: ${validationIssues}`));
      } else {
        console.error('[WebSocket] Unexpected error validating enrollment:', validationError);
        this.emitError(new Error('Unexpected error validating enrollment data'));
      }
      // Discard invalid message - do not update UI
    }
  }

  /**
   * Handle enrollment added event
   * Validates: Requirements 4.1, 4.3, 4.4, 8.2, 10.2
   * 
   * Process enrollment-added messages:
   * 1. Verify message has enrollment data
   * 2. Validate enrollment data against enrollmentSchema
   * 3. Log validation errors without crashing
   * 4. Notify handlers only if validation succeeds
   */
  private handleEnrollmentAdded(message: WebSocketMessage): void {
    if (!message.data?.enrollment) {
      const errorMsg = 'Enrollment added message missing enrollment data';
      console.warn('[WebSocket]', errorMsg);
      this.emitError(new Error(errorMsg));
      return;
    }

    try {
      // Validate enrollment data against schema
      const enrollment = enrollmentSchema.parse(message.data.enrollment);
      
      // Notify all handlers with validated enrollment
      this.onEnrollmentAddedHandlers.forEach((handler) => {
        try {
          handler(enrollment);
        } catch (handlerError) {
          console.error('[WebSocket] Error in enrollment added handler:', handlerError);
          // Continue with next handler even if one throws
        }
      });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.issues || [];
        const validationIssues = errors
          .map((e: any) => {
            const path = Array.isArray(e.path) ? e.path.join('.') : 'unknown';
            return `${path}: ${e.message}`;
          })
          .join(', ');
        console.error('[WebSocket] Enrollment data validation failed on added message:', validationIssues);
        console.error('[WebSocket] Invalid enrollment:', message.data.enrollment);
        this.emitError(new Error(`Invalid enrollment data in added message: ${validationIssues}`));
      } else {
        console.error('[WebSocket] Unexpected error validating enrollment:', validationError);
        this.emitError(new Error('Unexpected error validating enrollment data'));
      }
      // Discard invalid message - do not update UI
    }
  }

  /**
   * Handle enrollment removed event
   * Validates: Requirements 4.1, 4.3, 4.7, 8.3, 10.2
   * 
   * Process enrollment-removed messages:
   * 1. Verify message has enrollmentId
   * 2. Validate enrollmentId is valid UUID
   * 3. Log validation errors without crashing
   * 4. Notify handlers only if validation succeeds
   */
  private handleEnrollmentRemoved(message: WebSocketMessage): void {
    if (!message.data?.enrollmentId) {
      const errorMsg = 'Enrollment removed message missing enrollmentId';
      console.warn('[WebSocket]', errorMsg);
      this.emitError(new Error(errorMsg));
      return;
    }

    try {
      // Validate enrollmentId is a valid UUID
      const enrollmentId = z.string().uuid().parse(message.data.enrollmentId);
      
      // Remove from subscriptions
      this.subscriptions.delete(enrollmentId);
      
      // Notify all handlers with validated enrollmentId
      this.onEnrollmentRemovedHandlers.forEach((handler) => {
        try {
          handler(enrollmentId);
        } catch (handlerError) {
          console.error('[WebSocket] Error in enrollment removed handler:', handlerError);
          // Continue with next handler even if one throws
        }
      });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errors = validationError.issues || [];
        const validationIssues = errors
          .map((e: any) => {
            const path = Array.isArray(e.path) ? e.path.join('.') : 'unknown';
            return `${path}: ${e.message}`;
          })
          .join(', ');
        console.error('[WebSocket] Enrollment ID validation failed on removed message:', validationIssues);
        console.error('[WebSocket] Invalid enrollmentId:', message.data.enrollmentId);
        this.emitError(new Error(`Invalid enrollmentId in removed message: ${validationIssues}`));
      } else {
        console.error('[WebSocket] Unexpected error validating enrollmentId:', validationError);
        this.emitError(new Error('Unexpected error validating enrollmentId'));
      }
      // Discard invalid message - do not update UI
    }
  }

  /**
   * Handle connection disconnect
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6
   */
  private handleDisconnect(): void {
    this.ws = null;

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    // Only auto-reconnect if not intentionally disconnected
    if (this.status !== 'disconnected') {
      this.status = 'reconnecting';
      this.emitStatusChange('reconnecting');
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(event: Event): void {
    console.error('[WebSocket] Error:', event);
    if (this.status === 'connecting' || this.status === 'connected') {
      this.handleDisconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * Validates: Requirements 5.2, 5.3, 5.4
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Calculate delay with exponential backoff
    // timeout = min(2^n * initialDelay, maxDelay)
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(this.url, '', this.token)
        .then(() => {
          // Re-subscribe to all previous subscriptions
          const enrollmentIds = Array.from(this.subscriptions);
          enrollmentIds.forEach((id) => this.subscribe(id));
        })
        .catch((error) => {
          console.error('[WebSocket] Reconnection failed:', error);
          this.handleDisconnect();
        });
    }, delay);
  }

  /**
   * Send a WebSocket message
   */
  private sendMessage(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Error sending message:', error);
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit status change event
   */
  private emitStatusChange(status: ConnectionStatus): void {
    this.onStatusChangeHandlers.forEach((handler) => handler(status));
  }

  /**
   * Emit error event
   */
  private emitError(error: Error): void {
    this.onErrorHandlers.forEach((handler) => handler(error));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const websocketClient = new WebSocketClient();
export default websocketClient;
export type { ConnectionStatus, EnrollmentUpdatedHandler, EnrollmentAddedHandler, EnrollmentRemovedHandler };
