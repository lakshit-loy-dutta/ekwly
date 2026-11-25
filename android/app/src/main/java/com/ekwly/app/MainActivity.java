package com.ekwly.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (getBridge() != null && getBridge().getWebView() != null) {
            final WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void setLightBars(final boolean isLight) {
                    runOnUiThread(() -> {
                        Window w = getWindow();
                        View decor = w.getDecorView();
                        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(w, decor);
                        if (controller != null) {
                            controller.setAppearanceLightStatusBars(isLight);
                            controller.setAppearanceLightNavigationBars(isLight);
                        }
                    });
                }
            }, "EkwlyNativeBar");

            ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                float density = getResources().getDisplayMetrics().density;
                int topDp = Math.round(bars.top / density);
                int bottomDp = Math.round(Math.max(bars.bottom, ime.bottom) / density);

                String js = String.format(
                    "document.documentElement.style.setProperty('--safe-top', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-bottom', '%dpx');",
                    topDp, bottomDp
                );
                webView.post(() -> webView.evaluateJavascript(js, null));
                return ViewCompat.onApplyWindowInsets(v, windowInsets);
            });
        }
    }
}
