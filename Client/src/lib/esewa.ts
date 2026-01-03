//type definition
export type EsewaInitPayload = {
  amount: number;
  productName: string;
  transactionId: string;
  orderId?: number | string | null;
};

//function definition
export async function initiateEsewaPayment(
  apiBase: string,
  payload: EsewaInitPayload,
  token?: string
): Promise<void> { 
  const base = apiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/api/payments/esewa/initiate`, {   //api call to backend
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
    throw new Error(`Failed to initiate eSewa: ${res.status} ${text}`);
  }


  //parse backend response
  const data = await res.json();
  const endpoint: string = data.endpoint;
  const esewaConfig: Record<string, string | number> = data.esewaConfig || {};

  //Validation checks
  if (!endpoint || !esewaConfig || typeof esewaConfig !== 'object') {
    throw new Error('Invalid response from server for eSewa initiation');
  }

  //hidden html form
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = endpoint;
  form.style.display = 'none';

  Object.entries(esewaConfig).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  });

//append and submit form
  document.body.appendChild(form);
  setTimeout(() => form.submit(), 0);
}
