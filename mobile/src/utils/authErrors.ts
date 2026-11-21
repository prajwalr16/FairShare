export type FormattedAuthError = {
  title: string;
  message: string;
  actionHint?: string;
  isRateLimit?: boolean;
};

/**
 * Translates raw Supabase Auth and backend API errors into human-friendly,
 * descriptive diagnoses explaining the exact cause and next steps.
 */
export function formatAuthError(error: any): FormattedAuthError {
  if (!error) {
    return {
      title: 'Unknown Error',
      message: 'An unexpected issue occurred. Please try again.',
    };
  }

  const rawMessage = (
    typeof error === 'string'
      ? error
      : error.message || error.detail || error.error_description || ''
  ).toLowerCase();

  const status = Number(error?.status || 0);

  // 1. Supabase Hourly Email Rate Limit (Over rate limit)
  if (
    rawMessage.includes('email rate limit') ||
    rawMessage.includes('over_email_send_rate_limit') ||
    rawMessage.includes('rate limit exceeded') ||
    (status === 429 && rawMessage.includes('email'))
  ) {
    return {
      title: 'Hourly Email Limit Reached',
      message:
        'Supabase has temporarily capped automated verification emails (free tier limits emails per hour). You may need to wait up to an hour before requesting another confirmation email.',
      actionHint:
        'Good news: The group admin can add you as a placeholder member immediately so all your expenses are already tracked without waiting!',
      isRateLimit: true,
    };
  }

  // 2. 60-Second Security Cooldown
  if (
    rawMessage.includes('once every 60 seconds') ||
    rawMessage.includes('for security purposes')
  ) {
    return {
      title: 'Security Cooldown (60s)',
      message: 'For security purposes, please wait 60 seconds before requesting another email link.',
      actionHint: 'Please check your spam/junk folder before requesting again.',
      isRateLimit: true,
    };
  }

  // 3. User Already Exists
  if (
    rawMessage.includes('user already registered') ||
    rawMessage.includes('already in use') ||
    rawMessage.includes('already registered')
  ) {
    return {
      title: 'Account Already Exists',
      message: 'An account with this email address is already registered.',
      actionHint: 'Please go to the Login screen and sign in with your password, or use Forgot Password.',
    };
  }

  // 4. Invalid Login Credentials
  if (
    rawMessage.includes('invalid login credentials') ||
    rawMessage.includes('invalid_grant') ||
    rawMessage.includes('invalid credentials')
  ) {
    return {
      title: 'Incorrect Credentials',
      message: 'The email address or password you entered is incorrect.',
      actionHint: 'Double-check your spelling, or tap "Forgot Password" to reset your password.',
    };
  }

  // 5. Unconfirmed Email
  if (
    rawMessage.includes('email not confirmed') ||
    rawMessage.includes('confirm your email')
  ) {
    return {
      title: 'Email Verification Required',
      message: 'Your email address has not been confirmed yet.',
      actionHint: 'Please check your email inbox for the verification link before logging in.',
    };
  }

  // 6. Network / Backend Cold-Start Timeout
  if (
    rawMessage.includes('unable to reach') ||
    rawMessage.includes('network request failed') ||
    rawMessage.includes('failed to fetch') ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return {
      title: 'Connection Timeout',
      message: 'The server took longer than expected to respond.',
      actionHint: 'The backend cloud service may be warming up. Please wait 5 seconds and retry.',
    };
  }

  // 7. Fallback with cleaned original message
  const originalMessage = typeof error === 'string' ? error : error.message || error.detail;
  return {
    title: 'Authentication Error',
    message: originalMessage || 'Unable to complete authentication. Please try again.',
  };
}
