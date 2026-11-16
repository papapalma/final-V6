import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Share2, Copy, Check, AlertCircle, Loader } from 'lucide-react';
import { programSharingService, ShareableLinkResponse } from '../../services/programSharingService';
import featureFlagService from '../../services/featureFlagService';
import { useAuth } from '../../contexts/AuthContext';

export interface ProgramLinkGeneratorProps {
  programId: string;
  programName: string;
  onLinkGenerated?: (link: ShareableLinkResponse) => void;
}

/**
 * ProgramLinkGenerator Component
 * 
 * Generates and displays shareable links for programs with social media sharing options.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * Features:
 * - Checks if SOCIAL_PROGRAM_SHARING feature is enabled
 * - Generates shareable links with embedded program_id query parameter
 * - Displays shareable URL in UI
 * - Provides copy-to-clipboard functionality
 * - Shows social media share buttons
 * - Displays generated timestamp
 * - Idempotent: Same program always generates same link
 * - Shows Open Graph metadata
 */
export function ProgramLinkGenerator({
  programId,
  programName,
  onLinkGenerated,
}: ProgramLinkGeneratorProps) {
  const { user } = useAuth();
  const [shareLink, setShareLink] = useState<ShareableLinkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [featureCheckDone, setFeatureCheckDone] = useState(false);

  // Check if feature is enabled
  useEffect(() => {
    const checkFeature = async () => {
      if (!user?.tenantId) {
        setFeatureCheckDone(true);
        return;
      }

      try {
        const enabled = await featureFlagService.isFeatureEnabled(
          user.tenantId,
          featureFlagService.FeatureKeys.SOCIAL_PROGRAM_SHARING
        );
        setFeatureEnabled(enabled);
      } catch (err) {
        console.error('Error checking feature flag:', err);
        setFeatureEnabled(false);
      } finally {
        setFeatureCheckDone(true);
      }
    };

    checkFeature();
  }, [user?.tenantId]);

  // Generate link on mount or when programId changes (only if feature is enabled)
  useEffect(() => {
    if (!featureCheckDone || !featureEnabled) {
      return;
    }

    const generateLink = async () => {
      setLoading(true);
      setError(null);
      try {
        const link = await programSharingService.getShareableLink(programId);
        setShareLink(link);
        onLinkGenerated?.(link);
      } catch (err) {
        setError(
          err instanceof Error 
            ? `Failed to generate shareable link: ${err.message}`
            : 'Failed to generate shareable link'
        );
      } finally {
        setLoading(false);
      }
    };

    generateLink();
  }, [programId, onLinkGenerated, featureCheckDone, featureEnabled]);

  const handleCopyToClipboard = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink.url);
      setCopied(true);
      
      // Show toast notification
      // Using a simple implementation for now, could be enhanced with toast library
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleShareToSocial = (platform: 'facebook' | 'twitter' | 'whatsapp' | 'linkedin') => {
    if (!shareLink) return;

    // For now, copy to clipboard since we can't open social media share dialogs
    // These could be enhanced with actual share intent URLs
    const text = `Check out this program: ${programName}`;
    const url = shareLink.url;

    const shareText = `${text}\n${url}`;

    try {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(`Failed to copy ${platform} share text`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Don't render if feature is not enabled
  if (featureCheckDone && !featureEnabled) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            <CardTitle>Share Program Link</CardTitle>
          </div>
          {shareLink && (
            <Badge variant="outline" className="text-xs">
              Shareable
            </Badge>
          )}
        </div>
        <CardDescription>
          Generate and share this program on social media
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {(loading || !featureCheckDone) && (
          <div className="flex items-center justify-center p-8">
            <Loader className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {shareLink && !loading && (
          <>
            {/* Shareable Link Display */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Shareable Link</label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-md group">
                <input
                  type="text"
                  value={shareLink.url}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-600 dark:text-gray-400 outline-none"
                  data-testid="shareable-url-input"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyToClipboard}
                  className="hover:bg-gray-200 dark:hover:bg-gray-800"
                  data-testid="copy-button"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Generated Timestamp */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Generated: {formatDate(shareLink.generatedAt)}
            </div>

            {/* Social Media Share Buttons */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Share on Social Media</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShareToSocial('facebook')}
                  data-testid="share-facebook"
                >
                  Facebook
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShareToSocial('twitter')}
                  data-testid="share-twitter"
                >
                  Twitter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShareToSocial('whatsapp')}
                  data-testid="share-whatsapp"
                >
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShareToSocial('linkedin')}
                  data-testid="share-linkedin"
                >
                  LinkedIn
                </Button>
              </div>
            </div>

            {/* Open Graph Metadata Display */}
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <label className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Social Preview
              </label>
              <div className="space-y-1 text-sm">
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-300">
                    {shareLink.og.title}
                  </p>
                </div>
                <div>
                  <p className="text-blue-800 dark:text-blue-400 line-clamp-2">
                    {shareLink.og.description}
                  </p>
                </div>
                {shareLink.og.image && (
                  <div className="mt-2">
                    <img
                      src={shareLink.og.image}
                      alt="Social preview"
                      className="w-full h-32 object-cover rounded border border-blue-200 dark:border-blue-700"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
