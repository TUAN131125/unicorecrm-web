import assert from "node:assert/strict";
import { formatCommercialMoney } from "../../../src/shared/lib/format/commercialMoney";
import { formatCurrency } from "../../../src/shared/lib/format/currency";

assert.equal(formatCommercialMoney({ amount: "9007199254740993.12", currency: "USD" }, "en"), "9,007,199,254,740,993.12 USD");
assert.equal(formatCommercialMoney({ amount: "9007199254740993.12", currency: "USD" }, "vi"), "9.007.199.254.740.993,12 USD");
assert.equal(formatCommercialMoney({ amount: "247500", currency: "VND" }, "vi"), "247.500 VND");
assert.equal(formatCommercialMoney({ amount: "244.43", currency: "USD" }, "en"), "244.43 USD");
assert.equal(formatCommercialMoney({ amount: "1.234", currency: "KWD" }, "en"), "1.234 KWD");
assert.equal(formatCommercialMoney({ amount: "0", currency: "USD" }, "en"), "0.00 USD");
assert.equal(formatCommercialMoney({ amount: "-0.01", currency: "USD" }, "en"), "-0.01 USD");
assert.equal(formatCommercialMoney(undefined, "vi"), "—");
assert.equal(formatCommercialMoney({ amount: "1", currency: "" }, "en"), "—", "Missing currency must not become VND");
assert.equal(formatCommercialMoney({ amount: "NaN", currency: "USD" }, "en"), "—", "Invalid values must not become authoritative zero");
assert.match(formatCurrency(1.234, "KWD", "en"), /1\.234/u, "Currency precision must not crash KWD authoring/preview");
assert.equal(formatCurrency(100, "", "vi"), "—", "Missing currency cannot be inferred as VND");
assert.match(formatCurrency(244.43, "USD", "en"), /244\.43/u);
console.log("Exact commercial money presentation: PASS");
