import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/middleware/tenantContext';
import { handleOptionsRequest, corsResponse } from '@/middleware/cors';
import { logger } from '@/utils/logger';
import { uploadRequirementFile, getTraineeRequirementFiles } from '@/services/trainingRequirementService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUploadToken } from '@/lib/auth/jwt';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: traineeId } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const requirementType = formData.get('requirement_type') as string;

    if (!file) {
      return corsResponse({ error: 'No file provided' }, request, { status: 400 });
    }

    if (!requirementType) {
      return corsResponse({ error: 'Invalid requirement type' }, request, { status: 400 });
    }

    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .select('id, tenant_id, registration_status, user_id, email')
      .eq('id', traineeId)
      .single();

    if (traineeError || !trainee) {
      return corsResponse({ error: 'Trainee not found' }, request, { status: 404 });
    }

    let tenantId = trainee.tenant_id;
    let userId: string | undefined = trainee.user_id || undefined;

    // Check explicit X-Upload-Token first so an unrelated/stale session cookie or Bearer token
    // never blocks self-registration uploads with a cross-tenant 403.
    const explicitUploadToken =
      request.headers.get('x-upload-token') ||
      request.headers.get('X-Upload-Token');

    if (explicitUploadToken) {
      const verified = verifyUploadToken(explicitUploadToken);
      if (
        !verified ||
        verified.traineeId !== traineeId ||
        verified.tenantId !== trainee.tenant_id ||
        trainee.registration_status !== 'pending'
      ) {
        return corsResponse(
          { error: 'Unauthorized: Valid upload token required' },
          request,
          { status: 401 }
        );
      }
      tenantId = verified.tenantId;
      userId = trainee.user_id || undefined;
    } else {
      const ctxResult = requireTenantContext(request);
      if (!ctxResult.error && ctxResult.context) {
        if (trainee.tenant_id !== ctxResult.context.tenantId && !ctxResult.context.isSuperAdmin) {
          return corsResponse({ error: 'Unauthorized' }, request, { status: 403 });
        }
        tenantId = trainee.tenant_id;
        userId = ctxResult.context.userId;
      } else {
        const bearerUploadToken = request.headers
          .get('authorization')
          ?.replace(/^Bearer\s+/i, '');
        const verified = bearerUploadToken ? verifyUploadToken(bearerUploadToken) : null;

        if (
          !verified ||
          verified.traineeId !== traineeId ||
          verified.tenantId !== trainee.tenant_id ||
          trainee.registration_status !== 'pending'
        ) {
          return corsResponse(
            { error: 'Unauthorized: Valid upload token required' },
            request,
            { status: 401 }
          );
        }
        tenantId = verified.tenantId;
        userId = trainee.user_id || undefined;
      }
    }

    // Resolve user_id by trainee email if missing on the trainee row to satisfy uploaded_by FK
    if (!userId && trainee.email) {
      const { data: traineeUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', String(trainee.email).toLowerCase())
        .is('deleted_at', null)
        .maybeSingle();
      if (traineeUser?.id) {
        userId = traineeUser.id;
      }
    }

    const { data: requirementDefinition } = await supabaseAdmin
      .from('requirement_definitions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('requirement_type', requirementType)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (!requirementDefinition) {
      return corsResponse({ error: 'Requirement definition not found' }, request, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadedFile = await uploadRequirementFile({
      tenantId,
      traineeId,
      requirementType: requirementType as any,
      file: buffer,
      fileName: file.name,
      mimeType: file.type || undefined,
      userId: userId || '00000000-0000-0000-0000-000000000000',
    });

    logger.info('Requirement file uploaded', { traineeId, requirementType, userId });
    return corsResponse({ success: true, data: uploadedFile, file: uploadedFile }, request);
  } catch (error: any) {
    logger.error('Failed to upload requirement file', { error: error?.message });
    return corsResponse({ error: 'Failed to upload file' }, request, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return corsResponse(ctxResult.error as NextResponse, request);
    const context = ctxResult.context!;

    const { id: traineeId } = await params;
    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .select('id, tenant_id')
      .eq('id', traineeId)
      .single();

    if (traineeError || !trainee) {
      return corsResponse({ error: 'Trainee not found' }, request, { status: 404 });
    }

    if (trainee.tenant_id !== context.tenantId && !context.isSuperAdmin) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 403 });
    }

    const files = await getTraineeRequirementFiles(trainee.tenant_id, traineeId);
    logger.info('Requirement files retrieved', { traineeId, fileCount: files.length, userId: context.userId });
    return corsResponse({ success: true, files, data: files }, request);
  } catch (error: any) {
    logger.error('Failed to retrieve requirement files', { error: error?.message });
    return corsResponse({ error: 'Failed to retrieve files' }, request, { status: 500 });
  }
}