import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { ScrollText, ShieldAlert, RefreshCw, Clock, User, Filter } from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = filterAction === 'ALL'
    ? logs
    : logs.filter((l) => l.action.toLowerCase().includes(filterAction.toLowerCase()));

  const getActionBadge = (action: string) => {
    if (action.includes('DENIED') || action.includes('REJECTED') || action.includes('FAILED')) {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    if (action.includes('CORRECTED')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (action.includes('SUCCESS') || action.includes('CONFIRMED') || action.includes('LOGIN')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Security &amp; Inspection Audit Trail</h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable system logs documenting logins, inference dispatches, supervisor actions, and permission checks.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="glass-button-secondary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-300 font-medium">Filter Action:</span>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="glass-input px-3 py-1.5 rounded-lg text-xs"
        >
          <option value="ALL">All Recorded Actions</option>
          <option value="LOGIN">User Logins</option>
          <option value="INFERENCE">Inference Operations</option>
          <option value="REVIEW">Supervisor Reviews</option>
          <option value="DENIED">Security Denials</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto font-mono">{filteredLogs.length} events logged</span>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.03] text-slate-400 border-b border-white/5">
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Actor</th>
                <th className="py-2.5 px-4 font-semibold">Role</th>
                <th className="py-2.5 px-4 font-semibold">Action</th>
                <th className="py-2.5 px-4 font-semibold">Resource</th>
                <th className="py-2.5 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.01]">
                    <td className="py-2 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 font-medium text-white">{log.actorUsername}</td>
                    <td className="py-2 px-4 font-mono text-[11px] text-slate-300">{log.actorRole}</td>
                    <td className="py-2 px-4">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-300">
                      {log.resourceType}: {log.resourceId}
                    </td>
                    <td className="py-2 px-4 text-slate-300 text-[11px] max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
