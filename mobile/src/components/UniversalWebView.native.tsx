import React, { forwardRef } from 'react';
import { WebView as RNWebView, WebViewProps } from 'react-native-webview';

export type WebViewMessageEvent = {
  nativeEvent: {
    data: string;
    [key: string]: any;
  };
};

export type UniversalWebViewRef = RNWebView;

export const UniversalWebView = forwardRef<RNWebView, WebViewProps>((props, ref) => {
  return <RNWebView ref={ref} {...props} />;
});

UniversalWebView.displayName = 'UniversalWebView';

export default UniversalWebView;
export { UniversalWebView as WebView };
