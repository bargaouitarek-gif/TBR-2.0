package com.tbr.mobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

public class PdfOpenActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        forwardPdfToTbr(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forwardPdfToTbr(intent);
    }

    private void forwardPdfToTbr(Intent sourceIntent) {
        Uri pdfUri = sourceIntent != null ? sourceIntent.getData() : null;
        if (pdfUri == null) {
            Toast.makeText(this, "TBR n’a pas reçu le PDF.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        Intent target = new Intent(Intent.ACTION_SEND);
        target.setClass(this, LauncherActivity.class);
        target.setType("application/pdf");
        target.putExtra(Intent.EXTRA_STREAM, pdfUri);
        target.setClipData(ClipData.newRawUri("PDF TBR", pdfUri));
        target.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        CharSequence title = sourceIntent.getCharSequenceExtra(Intent.EXTRA_TITLE);
        if (title != null) {
            target.putExtra(Intent.EXTRA_TITLE, title);
        }

        try {
            startActivity(target);
        } catch (Exception error) {
            Toast.makeText(this, "Impossible d’ouvrir ce PDF dans TBR.", Toast.LENGTH_LONG).show();
        } finally {
            finish();
        }
    }
}
