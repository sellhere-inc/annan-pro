export const payment = {
  upiId: process.env.EXPO_PUBLIC_UPI_ID || '',
  recipient: process.env.EXPO_PUBLIC_UPI_RECIPIENT || '',
  amount: process.env.EXPO_PUBLIC_MEMBERSHIP_AMOUNT || '',
};
export function paymentUrl() {
  if (!payment.upiId || !payment.recipient || !/^\d+(\.\d{1,2})?$/.test(payment.amount) || Number(payment.amount) <= 0) throw new Error('Payment details are not available yet. Please contact the admin.');
  const params = new URLSearchParams({ pa: payment.upiId, pn: payment.recipient, am: payment.amount, cu: 'INR', tn: 'Circle membership' });
  return 'upi://pay?' + params.toString();
}
