import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/middleware/tenantContext';
import { handleOptionsRequest } from '@/middleware/cors';
import { logger } from '@/utils/logger';
import { uploadRequirementFile, getTraineeRequirementFiles } from '@/services/trainingRequirementService';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!requirementType) {
      return NextResponse.json({ error: 'Invalid requirement type' }, { status: 400 });
    }

    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .select('id, tenant_id, registration_status, user_id')
      .eq('id', traineeId)
      .single();

    if (traineeError || !trainee) {
      return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
    }

    let tenantId = trainee.tenant_id;
    let userId: string | undefined = trainee.user_id || undefined;

    const ctxResult = requireTenantContext(request);
    if (!ctxResult.error && ctxResult.context) {
      if (trainee.tenant_id !== ctxResult.context.tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      tenantId = ctxResult.context.tenantId;
      userId = ctxResult.context.userId;
    } else {
      // Allow unauthenticated upload if trainee is pending registration
      if (trainee.registration_status !== 'pending') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Requirement definition not found' }, { status: 404 });
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
    return NextResponse.json({ success: true, data: uploadedFile, file: uploadedFile });
  } catch (error: any) {
    logger.error('Failed to upload requirement file', { error: error?.message });
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return ctxResult.error as NextResponse;
    const context = ctxResult.context!;

    const { id: traineeId } = await params;
    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .select('id, tenant_id')
      .eq('id', traineeId)
      .single();

    if (traineeError || !trainee) {
      return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
    }

    if (trainee.tenant_id !== context.tenantId && !context.isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const files = await getTraineeRequirementFiles(context.tenantId, traineeId);
    logger.info('Requirement files retrieved', { traineeId, fileCount: files.length, userId: context.userId });
    return NextResponse.json({ success: true, files, data: files });
  } catch (error: any) {
    logger.error('Failed to retrieve requirement files', { error: error?.message });
    return NextResponse.json({ error: 'Failed to retrieve files' }, { status: 500 });
  }
}