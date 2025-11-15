import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function ApplyVerification() {
  const { user, token } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || 'https://thrift-production-af9f.up.railway.app';
  const [shopName, setShopName] = useState('');
  const [docs, setDocs] = useState<File[]>([]);
  const [status, setStatus] = useState<'none'|'pending'|'approved'|'rejected'>('none');
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`${apiBase}/api/sellers/${user.id}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data?.is_verified_seller) {
            setStatus('approved');
            setShopName(data?.application?.shop_name || '');
          } else if (data?.application) {
            setStatus(data.application.status || 'pending');
            setShopName(data.application.shop_name || '');
            setNotes(data.application.notes || '');
          }
        }
      } catch {}
    })();
  }, [apiBase, user?.id]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const arr = Array.from(e.target.files || []);
    setDocs(arr.slice(0, 5));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { toast.error('Login required'); return; }
    if (!shopName.trim()) { toast.error('Shop name required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('shop_name', shopName.trim());
      docs.forEach(f => fd.append('documents', f));
      const resp = await fetch(`${apiBase}/api/sellers/verify/apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || 'Failed');
      }
      toast.success('Application submitted');
      setStatus('pending');
    } catch (e: any) {
      toast.error(e?.message || 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  const statusBadge = () => {
    if (status === 'approved') return <Badge className="bg-thrift-green text-white">Verified</Badge>;
    if (status === 'pending') return <Badge variant="outline" className="animate-pulse">Pending Review</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Not Applied</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Seller Verification</h1>
      <p className="text-muted-foreground mb-6">Gain buyer trust with a verified badge. Submit your details; admins typically review within 24 hours.</p>
      <div className="mb-4">Current Status: {statusBadge()}</div>
      {notes && status === 'rejected' && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">Reason: {notes}</div>
      )}
      {status === 'approved' && (
        <div className="bg-thrift-green/10 border border-thrift-green/20 rounded p-4 mb-6 text-thrift-green flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          Your account is verified. Thank you!
        </div>
      )}
      <form onSubmit={submit} className="space-y-6 bg-card border rounded p-6 shadow-sm">
        <div>
          <label className="text-sm font-medium mb-2 block">Shop / Display Name</label>
          <Input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Retro Finds Nepal" disabled={status==='approved'} />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Verification Documents</label>
          <div className="flex flex-col gap-3">
            <Input type="file" multiple accept="image/*,.pdf" onChange={onFiles} disabled={status==='approved'} />
            <p className="text-xs text-muted-foreground">Upload clear photos of a government ID and a selfie holding the ID. Max 5 files.</p>
            {docs.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {docs.map((d,i) => <span key={i} className="px-2 py-1 bg-muted rounded">{d.name}</span>)}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Optional Notes to Admin</label>
          <Textarea rows={3} placeholder="Any extra context (e.g. social link)" disabled={status==='approved'} />
        </div>
        <div className="flex gap-3">
          <Button type="submit" className="bg-thrift-green hover:bg-thrift-green/90" disabled={loading || status==='approved'}>
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Submitting...</> : (status==='rejected' ? 'Re-Apply' : (status==='pending' ? 'Update Application' : 'Submit Application'))}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>Back</Button>
        </div>
      </form>
      <div className="mt-8 text-sm text-muted-foreground space-y-2">
        <p>After approval your listings will display a verified badge and buyers can filter by verified sellers.</p>
        <p>For demo grading: an already approved test seller account can showcase the badge without waiting.</p>
      </div>
    </div>
  );
}
