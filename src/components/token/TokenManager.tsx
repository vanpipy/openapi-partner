'use client';

/**
 * Token Manager Component
 * Create and manage API tokens using shadcn/ui
 */

import { useState, useTransition } from 'react';
import {
  createProjectToken,
  revokeProjectToken,
  getProjectTokens,
} from '@/app/actions/token';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Key,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface TokenListItem {
  id: number;
  name: string;
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

interface TokenManagerProps {
  projectId: number;
  initialTokens?: TokenListItem[];
}

export function TokenManager({ projectId, initialTokens = [] }: TokenManagerProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [isPending, startTransition] = useTransition();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newToken, setNewToken] = useState<{
    token: string;
    preview: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshTokens = async () => {
    const updatedTokens = await getProjectTokens(projectId);
    setTokens(updatedTokens);
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    const permissions: string[] = [];
    if (formData.get('permission-read')) permissions.push('read');
    if (formData.get('permission-write')) permissions.push('write');
    if (formData.get('permission-admin')) permissions.push('admin');

    startTransition(async () => {
      const result = await createProjectToken({
        projectId,
        name: formData.get('name') as string,
        permissions: permissions.length > 0 ? permissions : ['read'],
        expiresInDays: formData.get('expiresInDays')
          ? parseInt(formData.get('expiresInDays') as string)
          : undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setNewToken({
        token: result.data.token,
        preview: result.data.preview,
      });
      setShowCreateDialog(false);
      await refreshTokens();
    });
  };

  const handleRevoke = (tokenId: number) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    startTransition(async () => {
      await revokeProjectToken(tokenId, projectId);
      await refreshTokens();
    });
  };

  const handleCopy = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Tokens
            </CardTitle>
            <CardDescription>
              Manage authentication tokens for this project
            </CardDescription>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Token</DialogTitle>
                <DialogDescription>
                  Generate a new authentication token for API access
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreate} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tokenName">Token Name *</Label>
                  <Input
                    id="tokenName"
                    name="name"
                    required
                    placeholder="Production API Key"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Permissions</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="perm-read" name="permission-read" value="read" defaultChecked />
                      <Label htmlFor="perm-read" className="text-sm font-normal">
                        Read - Access generated types
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="perm-write" name="permission-write" value="write" />
                      <Label htmlFor="perm-write" className="text-sm font-normal">
                        Write - Trigger sync tasks
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="perm-admin" name="permission-admin" value="admin" />
                      <Label htmlFor="perm-admin" className="text-sm font-normal">
                        Admin - Full access
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresInDays">Expires In (Days)</Label>
                  <Input
                    id="expiresInDays"
                    name="expiresInDays"
                    type="number"
                    min="1"
                    placeholder="Leave empty for no expiration"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Token
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* New Token Display */}
        {newToken && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="space-y-3">
              <div className="font-medium text-green-800">Token Created!</div>
              <p className="text-sm text-green-700">
                Copy this token now. You won&apos;t be able to see it again.
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={newToken.token}
                  className="font-mono text-sm bg-white"
                />
                <Button onClick={handleCopy} variant="secondary" size="icon">
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setNewToken(null)}
                className="text-green-700 hover:text-green-800 p-0 h-auto"
              >
                I&apos;ve saved my token
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Token List */}
        {tokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No tokens yet. Create one to enable API access.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {token.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(token.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevoke(token.id)}
                      disabled={isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
