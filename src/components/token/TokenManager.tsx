'use client';

/**
 * Token Manager Component
 * Create and manage API tokens for a project
 */

import { useState, useTransition } from 'react';
import {
  createProjectToken,
  revokeProjectToken,
  getProjectTokens,
} from '@/app/actions/token';

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newToken, setNewToken] = useState<{
    token: string;
    preview: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshTokens = async () => {
    const updatedTokens = await getProjectTokens(projectId);
    setTokens(updatedTokens);
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createProjectToken({
        projectId,
        name: formData.get('name') as string,
        permissions: (formData.getAll('permissions') as string[]) || ['read'],
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
      setShowCreateForm(false);
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

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">API Tokens</h3>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setNewToken(null);
          }}
          className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Create Token
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {newToken && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="font-medium text-green-800 mb-2">Token Created!</h4>
          <p className="text-sm text-green-700 mb-2">
            Copy this token now. You won't be able to see it again.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={newToken.token}
              className="flex-1 px-3 py-2 text-sm font-mono bg-white border rounded"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(newToken.token);
                alert('Token copied to clipboard!');
              }}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewToken(null)}
            className="mt-2 text-sm text-green-700 underline"
          >
            I've saved my token
          </button>
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div>
            <label htmlFor="tokenName" className="block text-sm font-medium text-gray-700">
              Token Name *
            </label>
            <input
              type="text"
              id="tokenName"
              name="name"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Production API Key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="permissions"
                  value="read"
                  defaultChecked
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="ml-2 text-sm">Read - Access generated types</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="permissions"
                  value="write"
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="ml-2 text-sm">Write - Trigger sync tasks</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="expiresInDays" className="block text-sm font-medium text-gray-700">
              Expires In (Days)
            </label>
            <input
              type="number"
              id="expiresInDays"
              name="expiresInDays"
              min="1"
              placeholder="Leave empty for no expiration"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create Token'}
            </button>
          </div>
        </form>
      )}

      {tokens.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No tokens yet. Create one to enable API access.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Permissions
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Used
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Expires
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td className="px-4 py-2 text-sm font-medium">{token.name}</td>
                  <td className="px-4 py-2 text-sm">
                    <div className="flex gap-1">
                      {token.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-0.5 text-xs bg-gray-100 rounded"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {formatDate(token.lastUsedAt)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => handleRevoke(token.id)}
                      disabled={isPending}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
