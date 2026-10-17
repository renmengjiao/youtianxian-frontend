import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { common } from '@kit.AbilityKit';

const TAG = 'Index';
const DOMAIN = 0x0000;
const BASE_URL: string = 'https://harmony.local/';
const START_URL: string = BASE_URL + 'web/index.html';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  // 在 aboutToAppear() 中同步缓存 Context，避免异步回调中 getUIContext() 返回 undefined
  private hostContext?: common.Context;

  aboutToAppear(): void {
    try {
      webview.WebviewController.setWebDebuggingAccess(false);
    } catch (e) {
      hilog.warn(DOMAIN, TAG, 'setWebDebuggingAccess failed');
    }
    // 关键：在同步生命周期中缓存 hostContext，onInterceptRequest 是异步回调
    this.hostContext = this.getUIContext().getHostContext();
    if (!this.hostContext) {
      hilog.error(DOMAIN, TAG, 'aboutToAppear: getHostContext returned undefined');
    }
  }

  private getMimeType(path: string): string {
    if (path.endsWith('.html') || path.endsWith('.htm')) {
      return 'text/html';
    }
    if (path.endsWith('.js')) {
      return 'application/javascript';
    }
    if (path.endsWith('.css')) {
      return 'text/css';
    }
    if (path.endsWith('.json')) {
      return 'application/json';
    }
    if (path.endsWith('.svg')) {
      return 'image/svg+xml';
    }
    if (path.endsWith('.png')) {
      return 'image/png';
    }
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (path.endsWith('.gif')) {
      return 'image/gif';
    }
    if (path.endsWith('.webp')) {
      return 'image/webp';
    }
    if (path.endsWith('.ico')) {
      return 'image/x-icon';
    }
    if (path.endsWith('.woff2')) {
      return 'font/woff2';
    }
    if (path.endsWith('.woff')) {
      return 'font/woff';
    }
    if (path.endsWith('.wasm')) {
      return 'application/wasm';
    }
    return 'application/octet-stream';
  }

  private isTextMime(mimeType: string): boolean {
    return mimeType.startsWith('text/') ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/json' ||
      mimeType === 'image/svg+xml';
  }

  build() {
    Column() {
      Web({ src: START_URL, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .width('100%')
        .height('100%')
        .onInterceptRequest((event) => {
          if (!event || !event.request) {
            hilog.warn(DOMAIN, TAG, 'onInterceptRequest: event or request is null');
            return null;
          }
          const requestUrl: string = event.request.getRequestUrl();
          if (!requestUrl.startsWith(BASE_URL)) {
            return null;
          }
          // URL-decode to handle Chinese characters in path (browser encodes them)
          const relativePath: string = decodeURIComponent(requestUrl.substring(BASE_URL.length));
          try {
            if (!this.hostContext) {
              hilog.error(DOMAIN, TAG, 'hostContext is undefined');
              return null;
            }
            // 直接使用 relativePath，不再拼接 "web/" 前缀（否则变成 web/web/index.html）
            const rawData = this.hostContext.resourceManager.getRawFileContentSync(relativePath);
            const mimeType: string = this.getMimeType(relativePath);
            const response: WebResourceResponse = new WebResourceResponse();
            response.setResponseData(rawData.buffer as ArrayBuffer);
            response.setResponseMimeType(mimeType);
            if (this.isTextMime(mimeType)) {
              response.setResponseEncoding('utf-8');
            }
            response.setResponseIsReady(true);
            return response;
          } catch (e) {
            hilog.error(DOMAIN, TAG, 'Failed to load: %{public}s, error: %{public}s',
              relativePath, JSON.stringify(e));
            return null;
          }
        })
        .onErrorReceive((event) => {
          if (event) {
            hilog.error(DOMAIN, TAG, 'WebView load error');
          }
        })
        .onPageBegin((event) => {
          if (event) {
            hilog.info(DOMAIN, TAG, 'Page loading started');
          }
        })
        .onPageEnd((event) => {
          if (event) {
            hilog.info(DOMAIN, TAG, 'Page loading finished');
          }
        });
    }
    .width('100%')
    .height('100%');
  }
}
