import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';

export type WebViewMessageEvent = {
  nativeEvent: {
    data: string;
    [key: string]: any;
  };
};

export type UniversalWebViewRef = {
  injectJavaScript: (script: string) => void;
  reload: () => void;
  postMessage: (message: string) => void;
};

export interface UniversalWebViewProps {
  source?: {
    html?: string;
    baseUrl?: string;
    uri?: string;
    [key: string]: any;
  };
  style?: ViewStyle | ViewStyle[];
  onMessage?: (event: WebViewMessageEvent) => void;
  onLoad?: (event: any) => void;
  onLoadEnd?: (event: any) => void;
  renderLoading?: () => React.ReactElement;
  startInLoadingState?: boolean;
  [key: string]: any;
}

const RNWV_BRIDGE_SCRIPT = `
<script>
(function() {
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = {
      postMessage: function(msg) {
        try {
          var payload = typeof msg === 'string' ? msg : JSON.stringify(msg);
          window.parent.postMessage({ type: '__RNWV_POST_MESSAGE__', payload: payload }, '*');
        } catch (e) {
          console.error('[FairShare RNWV Bridge] Error sending message:', e);
        }
      }
    };
  }
})();
</script>
`;

export const UniversalWebView = forwardRef<UniversalWebViewRef, UniversalWebViewProps>(
  (
    {
      source,
      style,
      onMessage,
      onLoad,
      onLoadEnd,
      renderLoading,
      startInLoadingState = false,
    },
    ref,
  ) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [loading, setLoading] = useState(Boolean(startInLoadingState));

    // Handle messages sent from inside the iframe to the parent window
    useEffect(() => {
      const handleWindowMessage = (event: MessageEvent) => {
        if (!event.data || event.data.type !== '__RNWV_POST_MESSAGE__') return;

        // Filter messages to ensure they originate from our iframe
        if (!iframeRef.current || event.source === iframeRef.current.contentWindow) {
          onMessage?.({
            nativeEvent: {
              data: event.data.payload,
            },
          });
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('message', handleWindowMessage);
        return () => window.removeEventListener('message', handleWindowMessage);
      }
    }, [onMessage]);

    // Expose injectJavaScript and reload via ref
    useImperativeHandle(
      ref,
      () => ({
        injectJavaScript: (code: string) => {
          try {
            const iframe = iframeRef.current;
            if (!iframe?.contentWindow) return;

            const win = iframe.contentWindow as any;
            if (typeof win.eval === 'function') {
              win.eval(code);
            } else if (iframe.contentDocument) {
              const script = iframe.contentDocument.createElement('script');
              script.textContent = code;
              (iframe.contentDocument.head || iframe.contentDocument.body).appendChild(script);
              script.remove();
            }
          } catch (err) {
            console.warn('[UniversalWebView.web] injectJavaScript failed:', err);
          }
        },
        reload: () => {
          if (iframeRef.current) {
            if (source?.uri) {
              iframeRef.current.src = source.uri;
            } else if (source?.html) {
              iframeRef.current.srcdoc = iframeRef.current.srcdoc;
            }
          }
        },
        postMessage: (message: string) => {
          try {
            iframeRef.current?.contentWindow?.postMessage(
              { type: '__RNWV_HOST_MESSAGE__', payload: message },
              '*',
            );
          } catch (err) {
            console.warn('[UniversalWebView.web] postMessage failed:', err);
          }
        },
      }),
      [source],
    );

    const handleIframeLoad = useCallback(
      (event: any) => {
        setLoading(false);
        onLoad?.(event);
        onLoadEnd?.(event);
      },
      [onLoad, onLoadEnd],
    );

    // Prepare HTML with embedded React Native WebView bridge polyfill
    const processedHtml = useMemo(() => {
      if (!source?.html) return undefined;

      let html = source.html;

      // Inject base tag if baseUrl is provided and no base tag exists
      if (source.baseUrl && !html.includes('<base ')) {
        const baseTag = `<base href="${source.baseUrl}">`;
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${baseTag}`);
        } else {
          html = `${baseTag}${html}`;
        }
      }

      // Inject bridge script
      if (!html.includes('__RNWV_POST_MESSAGE__')) {
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${RNWV_BRIDGE_SCRIPT}`);
        } else if (html.includes('<body>')) {
          html = html.replace('<body>', `<body>${RNWV_BRIDGE_SCRIPT}`);
        } else {
          html = `${RNWV_BRIDGE_SCRIPT}${html}`;
        }
      }

      return html;
    }, [source?.baseUrl, source?.html]);

    return (
      <View style={[styles.container, style]}>
        <iframe
          ref={iframeRef}
          src={source?.uri}
          srcDoc={processedHtml}
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title="FairShare Map"
          allow="geolocation *"
        />

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            {renderLoading ? (
              renderLoading()
            ) : (
              <ActivityIndicator size="small" color="#0EA5A4" />
            )}
          </View>
        )}
      </View>
    );
  },
);

UniversalWebView.displayName = 'UniversalWebView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
});

export default UniversalWebView;
export { UniversalWebView as WebView };
