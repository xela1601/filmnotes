import { makeRoll } from "./fixtures";
import {
  fetchLabOrderStatus,
  fillLabTemplate,
  frameNumberFromFileName,
  labProfileIssues,
  type LabProfile,
} from "./labProfile";

const bare: LabProfile = {
  id: "labp00000000001",
  name: "Scanner at home",
  status: null,
  download: null,
  scanFrameNumberPattern: null,
  notes: "",
};

const drugstore: LabProfile = {
  ...bare,
  id: "labp00000000002",
  name: "Drugstore lab",
  status: {
    urlTemplate: "https://status.example/order?shop={shop}&order={orderId}",
    params: ["shop", "orderId"],
  },
  download: {
    urlTemplate: "https://files.example/{orderId}/{secureId}/download",
    params: ["orderId", "secureId"],
  },
  scanFrameNumberPattern: "Neg\\.Nr\\.(\\d+)",
};

describe("labProfileIssues", () => {
  it("accepts a profile without any endpoint - a scanner at home is a route too", () => {
    expect(labProfileIssues(bare)).toEqual([]);
  });

  it("accepts a profile whose templates and parameters agree", () => {
    expect(labProfileIssues(drugstore)).toEqual([]);
  });

  it("names a placeholder the parameters do not declare, and a parameter the URL never uses", () => {
    const issues = labProfileIssues({
      ...drugstore,
      status: {
        urlTemplate: "https://status.example/{orderId}?c={config}",
        params: ["orderId", "shop"],
      },
    });

    expect(issues).toEqual([
      "status: placeholder {config} is not a declared parameter",
      "status: parameter shop does not appear in the URL",
    ]);
  });

  it("refuses a frame pattern that does not compile or captures nothing", () => {
    expect(labProfileIssues({ ...bare, scanFrameNumberPattern: "Neg(" })).toEqual([
      "scanFrameNumberPattern: not a valid regular expression",
    ]);
    expect(labProfileIssues({ ...bare, scanFrameNumberPattern: "Neg\\.Nr\\.\\d+" })).toEqual([
      "scanFrameNumberPattern: needs one capture group for the frame number",
    ]);
  });
});

describe("fillLabTemplate", () => {
  it("fills every placeholder, URL-encoded", () => {
    expect(fillLabTemplate(drugstore.status, { shop: "A B", orderId: "004304-540996" })).toEqual({
      ok: true,
      url: "https://status.example/order?shop=A%20B&order=004304-540996",
    });
  });

  it("says which values are missing instead of building half a URL", () => {
    expect(fillLabTemplate(drugstore.download, { orderId: "540996", secureId: "  " })).toEqual({
      ok: false,
      reason: "missing",
      missing: ["secureId"],
    });
  });

  it("says so when the profile has no such endpoint", () => {
    expect(fillLabTemplate(bare.download, {})).toEqual({ ok: false, reason: "no-endpoint" });
  });
});

describe("frameNumberFromFileName", () => {
  it("reads the frame number the pattern captures", () => {
    expect(frameNumberFromFileName("Neg\\.Nr\\.(\\d+)", "_Bild000_Neg.Nr.25.jpg")).toBe(25);
    expect(frameNumberFromFileName("Neg\\.Nr\\.(\\d+)", "_Bild011_Neg.Nr.36.jpg")).toBe(36);
  });

  it("is null without a pattern, without a match, or for a number that is no frame", () => {
    expect(frameNumberFromFileName(null, "_Bild000_Neg.Nr.25.jpg")).toBeNull();
    expect(frameNumberFromFileName("Neg\\.Nr\\.(\\d+)", "IMG_0001.JPG")).toBeNull();
    expect(frameNumberFromFileName("Neg\\.Nr\\.(\\d+)", "_Bild000_Neg.Nr.0.jpg")).toBeNull();
  });
});

describe("Roll.labProfileId", () => {
  it("is empty by default: a roll needs no lab at all", () => {
    expect(makeRoll().labProfileId).toBeNull();
  });
});

// The answer for order 540996 on 2026-09-28, with the branch, customer and shop numbers replaced.
const DELIVERED = {
  resultDateTime: "2026-09-28T18:03:44+0200",
  summaryStateCode: "DELIVERED",
  summaryDate: "2026-09-26",
  summaryStateText: "Dein Auftrag liegt zur Abholung bereit.",
  summaryPrice: 391,
  customerNo: "000000",
  shopNo: "00000",
  orderNo: "540996",
  orderDate: "2026-09-21",
  deliveryType: 0,
  deliveryText: "dm-drogerie markt\nMusterstraße 1\n00000 Musterstadt",
  subOrders: [{ orderNo: "540996", stateCode: "DELIVERED", trackingNumber: null }],
};

describe("fetchLabOrderStatus", () => {
  const values = { config: "1", shop: "X", orderId: "004304-540996" };
  const answering = (answer: unknown) => {
    const urls: string[] = [];
    return {
      urls,
      fetchJson: (url: string) => {
        urls.push(url);
        return Promise.resolve(answer);
      },
    };
  };

  it("reads state, date, order and branch out of a real answer", async () => {
    const port = answering(DELIVERED);

    await expect(fetchLabOrderStatus(drugstore, values, port.fetchJson)).resolves.toEqual({
      ok: true,
      status: {
        stateCode: "DELIVERED",
        stateText: "Dein Auftrag liegt zur Abholung bereit.",
        date: "2026-09-26",
        orderNo: "540996",
        deliveryText: "dm-drogerie markt\nMusterstraße 1\n00000 Musterstadt",
      },
    });
    expect(port.urls).toEqual(["https://status.example/order?shop=X&order=004304-540996"]);
  });

  it("does not ask when there is nothing to ask", async () => {
    const port = answering(DELIVERED);

    await expect(fetchLabOrderStatus(null, values, port.fetchJson)).resolves.toEqual({
      ok: false,
      error: "no-profile",
    });
    await expect(fetchLabOrderStatus(bare, values, port.fetchJson)).resolves.toEqual({
      ok: false,
      error: "no-status-endpoint",
    });
    await expect(
      fetchLabOrderStatus(drugstore, { ...values, orderId: null }, port.fetchJson),
    ).resolves.toEqual({ ok: false, error: "no-order" });
    await expect(
      fetchLabOrderStatus(drugstore, { orderId: "540996" }, port.fetchJson),
    ).resolves.toEqual({ ok: false, error: "missing-parameters", missing: ["shop"] });
    expect(port.urls).toEqual([]);
  });

  it("tells a network failure from an answer it cannot read", async () => {
    const offline = () => Promise.reject(new TypeError("Network request failed"));
    await expect(fetchLabOrderStatus(drugstore, values, offline)).resolves.toEqual({
      ok: false,
      error: "network",
    });

    for (const answer of [null, "<html>", { summaryStateCode: 3 }, { orderNo: "540996" }]) {
      await expect(
        fetchLabOrderStatus(drugstore, values, answering(answer).fetchJson),
      ).resolves.toEqual({ ok: false, error: "unexpected-answer" });
    }
  });
});
