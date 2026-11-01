import { configureImageUploads, isDataUrl, parseDataUrl, uploadDataUrlImage, uploadImagesIn } from "./uploadImage.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

async function run() {
    assert(isDataUrl("data:image/png;base64,AAA") && !isDataUrl("/user/images/a.png") && !isDataUrl(null), "isDataUrl");

    const png = parseDataUrl("data:image/png;base64,iVBORw0KGgo=");
    assert(png?.format === "png" && png.base64 === "iVBORw0KGgo=", "parses png");
    assert(parseDataUrl("data:image/jpeg;base64,AAAA")?.format === "jpg", "jpeg is stored as jpg");
    assert(parseDataUrl("data:image/svg+xml;base64,AAAA") === null, "svg is not accepted");
    assert(parseDataUrl("data:image/png,rawtext") === null, "non-base64 is not accepted");
    assert(parseDataUrl("/user/images/a.png") === null, "paths are not data URLs");

    configureImageUploads({ getRequestHeaders: () => ({ "X-Test": "1" }) });
    const requests = [];
    const okFetch = async (url, init) => {
        requests.push({ url, init });
        const body = JSON.parse(init.body);
        return { ok: true, json: async () => ({ path: `/user/images/${body.ch_name}/${body.filename}.${body.format}` }) };
    };
    const path = await uploadDataUrlImage("data:image/webp;base64,UklG", { prefix: "truth", fetchImpl: okFetch });
    assert(path?.startsWith("/user/images/danganronpa/truth_") && path.endsWith(".webp"), "returns the stored path");
    const sent = JSON.parse(requests[0].init.body);
    assert(requests[0].url === "/api/images/upload" && sent.image === "UklG" && sent.format === "webp", "posts the base64 and format");
    assert(requests[0].init.headers["X-Test"] === "1", "uses SillyTavern's request headers");

    const failFetch = async () => ({ ok: false, json: async () => ({}) });
    assert(await uploadDataUrlImage("data:image/png;base64,AAAA", { fetchImpl: failFetch }) === null, "failed upload returns null");
    const throwFetch = async () => { throw new Error("offline"); };
    assert(await uploadDataUrlImage("data:image/png;base64,AAAA", { fetchImpl: throwFetch }) === null, "network error returns null");

    let uploads = 0;
    const upload = async (dataUrl) => { uploads += 1; return dataUrl.includes("BAD") ? null : `/user/images/x/${uploads}.png`; };
    const items = [
        { image: "data:image/png;base64,ONE" },
        { image: "data:image/png;base64,ONE" },
        { image: "/user/images/x/already.png" },
        { image: "data:image/png;base64,BAD" },
        {},
    ];
    const replaced = await uploadImagesIn(items, { upload });
    assert(replaced === 2, "replaces uploaded data URLs");
    assert(uploads === 2, "the same picture is uploaded once per pass");
    assert(items[0].image === items[1].image && items[0].image.startsWith("/user/images/"), "duplicates share a path");
    assert(items[2].image === "/user/images/x/already.png", "paths are left alone");
    assert(items[3].image.startsWith("data:"), "failed uploads keep the data URL");

    console.log("uploadImage tests passed");
}

run();
