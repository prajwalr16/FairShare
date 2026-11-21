import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildUpiUri,
  buildDirectUpiUri,
  buildWhatsAppReminder,
  isValidUpiId,
  getUpiQrCodeUrl,
  getUpiQrCodeFallbackUrl,
  COMMON_UPI_HANDLES,
} from './upiScheme.ts';

describe('upiScheme Utility Unit Tests', () => {
  it('validates authentic NPCI UPI Virtual Payment Addresses', () => {
    assert.strictEqual(isValidUpiId('prajwal@okhdfcbank'), true);
    assert.strictEqual(isValidUpiId('9876543210@paytm'), true);
    assert.strictEqual(isValidUpiId('john.doe@ybl'), true);
    assert.strictEqual(isValidUpiId('rahul_12@okaxis'), true);
    assert.strictEqual(isValidUpiId('business-merchant@icici'), true);
  });

  it('rejects invalid or placeholder UPI IDs', () => {
    assert.strictEqual(isValidUpiId(''), false);
    assert.strictEqual(isValidUpiId(null), false);
    assert.strictEqual(isValidUpiId('prajwal'), false); // Missing @handle
    assert.strictEqual(isValidUpiId('prajwal@'), false); // Empty handle
    assert.strictEqual(isValidUpiId('@okhdfcbank'), false); // Empty username
    assert.strictEqual(isValidUpiId('has space@upi'), false);
    assert.strictEqual(isValidUpiId('member@upi'), false); // Generic placeholder
    assert.strictEqual(isValidUpiId('payee@upi'), false); // Generic placeholder
  });

  it('builds standard NPCI compliant UPI URI with correct parameter encoding', () => {
    const uri = buildUpiUri({
      payeeUpiId: 'prajwal@okhdfcbank',
      payeeName: 'Prajwal R',
      amount: 450.5,
      note: 'Dinner & drinks',
    });

    assert.ok(uri.startsWith('upi://pay?'));
    assert.ok(uri.includes('pa=prajwal@okhdfcbank'));
    assert.ok(uri.includes('pn=Prajwal%20R'));
    assert.ok(uri.includes('am=450.50')); // 2 decimal places
    assert.ok(uri.includes('cu=INR'));
    assert.ok(uri.includes('tn=Dinner%20%26%20drinks'));
  });

  it('formats zero or negative amounts safely to 0.00', () => {
    const uri = buildUpiUri({
      payeeUpiId: 'test@okaxis',
      payeeName: 'Tester',
      amount: -100,
    });
    assert.ok(uri.includes('am=0.00'));
  });

  it('generates QR code URL with mandatory quiet zone margin=4 for camera scanning', () => {
    const uri = 'upi://pay?pa=test@okaxis&pn=Test&am=100.00&cu=INR';
    const qrUrl = getUpiQrCodeUrl(uri, 250);

    assert.ok(qrUrl.includes('api.qrserver.com'));
    assert.ok(qrUrl.includes('size=250x250'));
    assert.ok(qrUrl.includes('margin=4')); // ISO scanner quiet zone
    assert.ok(qrUrl.includes(encodeURIComponent(uri)));
  });

  it('generates fallback QR code URL with margin=4', () => {
    const uri = 'upi://pay?pa=test@okaxis&pn=Test&am=100.00&cu=INR';
    const fallbackUrl = getUpiQrCodeFallbackUrl(uri, 250);

    assert.ok(fallbackUrl.includes('quickchart.io'));
    assert.ok(fallbackUrl.includes('margin=4'));
    assert.ok(fallbackUrl.includes(encodeURIComponent(uri)));
  });

  it('provides standard popular Indian bank UPI handles', () => {
    assert.ok(COMMON_UPI_HANDLES.includes('@okhdfcbank'));
    assert.ok(COMMON_UPI_HANDLES.includes('@okaxis'));
    assert.ok(COMMON_UPI_HANDLES.includes('@paytm'));
    assert.ok(COMMON_UPI_HANDLES.includes('@ybl'));
  });

  it('builds direct deep links for Google Pay, PhonePe, and Paytm', () => {
    const params = {
      payeeUpiId: 'rahul@okhdfcbank',
      payeeName: 'Rahul',
      amount: 450,
      note: 'Dinner split',
    };

    const gpayUri = buildDirectUpiUri('gpay', params);
    assert.ok(gpayUri.startsWith('tez://upi/pay?'));
    assert.ok(gpayUri.includes('pa=rahul@okhdfcbank'));
    assert.ok(gpayUri.includes('am=450.00'));

    const phonepeUri = buildDirectUpiUri('phonepe', params);
    assert.ok(phonepeUri.startsWith('phonepe://pay?'));
    assert.ok(phonepeUri.includes('pa=rahul@okhdfcbank'));

    const paytmUri = buildDirectUpiUri('paytm', params);
    assert.ok(paytmUri.startsWith('paytmmp://pay?'));
    assert.ok(paytmUri.includes('pa=rahul@okhdfcbank'));

    const genericUri = buildDirectUpiUri('generic', params);
    assert.ok(genericUri.startsWith('upi://pay?'));
  });

  it('builds friendly WhatsApp settlement reminder with amount and payment URI', () => {
    const reminderUrl = buildWhatsAppReminder({
      payeeName: 'Prajwal',
      amount: 750,
      currency: 'INR',
      groupName: 'Goa Trip',
      payeeUpiId: 'prajwal@okhdfcbank',
    });

    assert.ok(reminderUrl.startsWith('https://wa.me/?text='));
    const decoded = decodeURIComponent(reminderUrl);
    assert.ok(decoded.includes('Goa Trip'));
    assert.ok(decoded.includes('750.00'));
    assert.ok(decoded.includes('Prajwal'));
    assert.ok(decoded.includes('prajwal@okhdfcbank'));
    assert.ok(decoded.includes('upi://pay?'));
  });
});
