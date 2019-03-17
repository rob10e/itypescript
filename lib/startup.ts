declare var $$;

class $TS {
    static done() {
        return $TS.retrieve();
    }

    static retrieve(result?: any) {
        if (result) {
            $$.sendResult(result);
        } else {
            $$.done();
        }
    }

    static put(mimeType: string, obj: string) {
        let result = {};
        result[mimeType] = obj;
        $$.mime(result);
    }

    static html(html: string) {
        $TS.put("text/html", html);
    }

    static svg(xml: string) {
        $TS.put("image/svg+xml", xml);
    }

    static png(base64: string) {
        $TS.put("image/png", base64);
    }

    static pngFile(path: string) {
        let base64 = require("fs").readFileSync(path).toString("base64");
        $TS.png(base64);
    }

    static jpg(base64: string) {
        $TS.put("image/jpeg", base64);
    }

    static jpgFile(path: string) {
        let base64 = require("fs").readFileSync(path).toString("base64");
        $TS.jpg(base64);
    }

    static log(text: string) {
        $TS.put("text/plain", text);
    }

    static error(error: Error) {
        $$.sendError(error);
    }
}
