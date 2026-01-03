//type definition
export type KhaltiInitPayload = {
  amount: number;
  productName: string;
  orderId?: number | string | null;
};

/**
 * Initiates a Khalti payment by calling the server and redirecting to the returned payment_url.
 */

//function definition
export async function initiateKhaltiPayment(
  apiBase: string,
  payload: KhaltiInitPayload,
  token?: string
): Promise<void> {
  const base = apiBase.replace(/\/$/, '');
  const res = await fetch(`${base}/api/payments/khalti/initiate`, { //api call to backend
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  //api error handling
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to initiate Khalti: ${res.status} ${text}`);
  }
  const data = await res.json(); //parse backend response
  const url = data.payment_url as string | undefined;
  if (!url) throw new Error('No Khalti payment_url received');
  window.location.href = url;
}
