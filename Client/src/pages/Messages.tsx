import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageRow {
  id: number;
  product_id: number;
  sender_id: number | null;
  recipient_id: number;
  content: string;
  created_at: string;
  read_at?: string | null;
  product_title?: string;
}

export default function Messages() {
  const { token, isAuthenticated, user } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`${apiBase}/api/messages`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!r.ok) throw new Error("Failed to load messages");
        const data = await r.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load messages");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, token, isAuthenticated]);

  const me = useMemo(() => (user?.id ? Number(user.id) : null), [user]);

  // Group by conversation: product + otherParty
  const conversations = useMemo(() => {
    const map = new Map<string, MessageRow[]>();
    for (const m of rows) {
      const other = me === null ? (m.sender_id || m.recipient_id) : (m.sender_id === me ? m.recipient_id : m.sender_id || m.recipient_id);
      const key = `${m.product_id}:${other}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    // sort messages within conversation by created_at ascending
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return Array.from(map.entries()).map(([key, messages]) => ({ key, messages }));
  }, [rows, me]);

  const sendReply = async (convKey: string, productId: number, toUserId: number) => {
    const content = (drafts[convKey] || "").trim();
    if (!content) return;
    try {
      setSendingKey(convKey);
      const resp = await fetch(`${apiBase}/api/messages/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ productId, toUserId, content }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      // Optimistically append
      const now = new Date().toISOString();
      const newRow: MessageRow = {
        id: Math.floor(Math.random() * 1e9),
        product_id: productId,
        sender_id: me,
        recipient_id: toUserId,
        content,
        created_at: now,
        product_title: rows.find(r => r.product_id === productId)?.product_title,
      } as MessageRow;
      setRows(prev => [...prev, newRow]);
      setDrafts(prev => ({ ...prev, [convKey]: "" }));
    } catch (e) {
      // TODO: toast error
      console.error(e);
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Messages</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <div className="space-y-4">
          {conversations.length === 0 ? (
            <p className="text-muted-foreground">No messages yet.</p>
          ) : (
            conversations.map(({ key, messages }) => {
              const first = messages[0];
              const partnerId = me === null ? (first.sender_id || first.recipient_id) : (first.sender_id === me ? first.recipient_id : (first.sender_id || first.recipient_id));
              const productId = first.product_id;
              const title = first.product_title || first.product_id;
              return (
                <div key={key} className="border rounded p-3 bg-card max-w-2xl mx-auto shadow-sm">
                  <div className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
                    <div>
                      Product: {title}
                    </div>
                    <Button asChild variant="link" className="p-0 h-auto">
                      <a href={`/product/${productId}`}>View listing</a>
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`px-3 py-2 rounded border ${m.sender_id === me ? 'bg-thrift-green/10 border-thrift-green/30 ml-auto max-w-[80%]' : 'bg-muted/40 border-muted/60 mr-auto max-w-[80%]'}`}
                      >
                        <div className="text-xs text-muted-foreground mb-1">{new Date(m.created_at).toLocaleString()}</div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start gap-2">
                    <Textarea
                      placeholder="Write a reply..."
                      value={drafts[key] || ''}
                      onChange={(e) => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                      className="min-h-[60px]"
                    />
                    <Button
                      onClick={() => sendReply(key, productId, Number(partnerId))}
                      disabled={sendingKey === key || !token || !(drafts[key] || '').trim()}
                    >
                      {sendingKey === key ? 'Sending...' : 'Reply'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
