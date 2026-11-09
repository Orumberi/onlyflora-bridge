package ru.onlyflora.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.SafeBrowsingResponse;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String APP_HOST = "app.onlyflora.ru";
    private static final String WEB_RESET_KEY = "web-profile-reset-1.0.3";

    private WebView webView;
    private View errorView;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean resetLegacyWebProfile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(0, 126, 63));
        getWindow().setNavigationBarColor(Color.rgb(0, 126, 63));

        FrameLayout root = new FrameLayout(this);
        webView = createWebView();
        errorView = createErrorView();
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(errorView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        resetLegacyWebProfile = !getPreferences(MODE_PRIVATE)
                .getBoolean(WEB_RESET_KEY, false);
        if (resetLegacyWebProfile) {
            webView.clearCache(true);
        }

        if (savedInstanceState == null) {
            loadApplication();
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private WebView createWebView() {
        WebView view = new WebView(this);
        view.setBackgroundColor(Color.rgb(241, 247, 243));
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(
                settings.getUserAgentString() + " OnlyFloraAndroid/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(view, true);

        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView currentView, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView currentView, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView currentView, String url, android.graphics.Bitmap favicon) {
                if (isInternalUrl(Uri.parse(url))) {
                    showWebView();
                }
            }

            @Override
            public void onPageFinished(WebView currentView, String url) {
                if (!isInternalUrl(Uri.parse(url))) {
                    return;
                }

                currentView.evaluateJavascript(
                        "document.documentElement.classList.add('onlyflora-android');",
                        null);

                if (!resetLegacyWebProfile) {
                    return;
                }
                resetLegacyWebProfile = false;
                getPreferences(MODE_PRIVATE).edit()
                        .putBoolean(WEB_RESET_KEY, true)
                        .apply();
                currentView.evaluateJavascript(
                        "(async()=>{" +
                                "try{if('serviceWorker'in navigator){" +
                                "const r=await navigator.serviceWorker.getRegistrations();" +
                                "await Promise.all(r.map(x=>x.unregister()));}}catch(e){}" +
                                "try{if('caches'in window){const k=await caches.keys();" +
                                "await Promise.all(k.map(x=>caches.delete(x)));}}catch(e){}" +
                                "location.replace('https://app.onlyflora.ru/?source=android&v=10003');" +
                                "})()",
                        null);
            }

            @Override
            public void onReceivedError(
                    WebView currentView,
                    WebResourceRequest request,
                    WebResourceError error) {
                if (request.isForMainFrame()) {
                    showError();
                }
            }

            @Override
            public void onReceivedHttpError(
                    WebView currentView,
                    WebResourceRequest request,
                    WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    showError();
                }
            }

            @Override
            public void onSafeBrowsingHit(
                    WebView currentView,
                    WebResourceRequest request,
                    int threatType,
                    SafeBrowsingResponse callback) {
                callback.backToSafety(true);
                showError();
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView source,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        return view;
    }

    private View createErrorView() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        container.setPadding(dp(28), dp(28), dp(28), dp(28));
        container.setBackgroundColor(Color.rgb(241, 247, 243));
        container.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText("Не удалось открыть OnlyFlora");
        title.setTextColor(Color.rgb(5, 45, 35));
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        container.addView(title);

        TextView message = new TextView(this);
        message.setText("Проверьте подключение к интернету и попробуйте ещё раз.");
        message.setTextColor(Color.rgb(91, 112, 103));
        message.setTextSize(16);
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        messageParams.setMargins(0, dp(12), 0, dp(24));
        container.addView(message, messageParams);

        Button retry = new Button(this);
        retry.setText("Повторить");
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(16);
        retry.setAllCaps(false);
        retry.setBackgroundColor(Color.rgb(0, 145, 72));
        retry.setOnClickListener(button -> loadApplication());
        container.addView(retry, new LinearLayout.LayoutParams(dp(190), dp(56)));

        return container;
    }

    private boolean handleNavigation(Uri uri) {
        if (isInternalUrl(uri)) {
            return false;
        }
        openExternal(uri);
        return true;
    }

    private boolean isInternalUrl(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        return "https".equalsIgnoreCase(scheme)
                && host != null
                && APP_HOST.equalsIgnoreCase(host);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // Stay in the application when Android cannot handle the link.
        }
    }

    private void loadApplication() {
        showWebView();
        webView.loadUrl(BuildConfig.APP_URL);
    }

    private void showWebView() {
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void showError() {
        webView.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (errorView.getVisibility() == View.VISIBLE) {
            loadApplication();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
