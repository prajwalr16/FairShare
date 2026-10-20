import React, { forwardRef } from 'react';
import { Platform } from 'react-native';

import NativeWebView, {
  UniversalWebViewRef as NativeRef,
  WebViewMessageEvent as NativeMessageEvent,
} from './UniversalWebView.native';
import WebWebView, {
  UniversalWebViewRef as WebRef,
  WebViewMessageEvent as WebMessageEvent,
} from './UniversalWebView.web';

export type WebViewMessageEvent = NativeMessageEvent | WebMessageEvent;
export type UniversalWebViewRef = NativeRef | WebRef;

export const UniversalWebView = forwardRef<any, any>((props, ref) => {
  if (Platform.OS === 'web') {
    return <WebWebView ref={ref} {...props} />;
  }
  return <NativeWebView ref={ref} {...props} />;
});

UniversalWebView.displayName = 'UniversalWebView';

export default UniversalWebView;
export { UniversalWebView as WebView };
