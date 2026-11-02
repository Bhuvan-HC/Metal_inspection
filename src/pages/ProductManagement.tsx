import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { Package, PlusCircle, CheckCircle2, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';

export const ProductManagement: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const created = await api.createProduct({
        productId: productId.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
      });
      setSuccess(`Product ${created.productId} registered successfully.`);
      setProductId('');
      setName('');
      setDescription('');
      setShowForm(false);
      loadProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to register product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Manufactured Product Registry</h2>
          <p className="text-xs text-slate-400 mt-1">
            Registered industrial components supported by computer vision inspection pipelines.
          </p>
        </div>

        {isPrivileged ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{showForm ? 'Cancel Registration' : 'Register New Product'}</span>
          </button>
        ) : (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Product Registration Restricted to Admin</span>
          </div>
        )}
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form (Collapsible) */}
      {showForm && isPrivileged && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-semibold text-white">Register Manufactured Product Specification</h3>

          <form onSubmit={handleRegisterProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Product ID / Code</label>
              <input
                type="text"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="e.g. P-PLATE02"
                required
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Product Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Industrial Aluminum Bracket"
                required
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Product Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. CNC milled surface plate with surface finish inspection criteria"
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="glass-button-secondary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="glass-button-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Save Registration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((p) => (
          <div key={p.id} className="glass-card p-5 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{p.name}</h3>
                  <div className="text-[11px] font-mono text-cyan-300">{p.productId}</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold uppercase">
                Active Specification
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
              <span>Classifier: BIT-PLATE-CV-1.0</span>
              <span>Registered: {new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
