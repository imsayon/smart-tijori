import "server-only";
import { createPostgresPool } from "../../db/pool";
import { createDatabase } from "../../db/database";
import { createCommerceCommands } from "../../commerce/commands";
import { databaseTime, inventoryFacts } from "../../commerce/inventory";
import type { Outcome } from "../../contracts/commerce";
import { HttpError } from "../errors/http-errors";
import type { CommerceCommands } from "./commerce-commands";

const guest = (id: string) => ({ kind: "shopper" as const, id });

function value<T>(result: Outcome<T>): T {
  if (result.ok) return result.value;
  throw new HttpError(result.error.code, result.error.message, undefined, result.error.productIds);
}

export function postgresCommerce(): CommerceCommands {
  const db = createDatabase(createPostgresPool(), process.env.ST_DB_SCHEMA ?? "");
  const commands = createCommerceCommands(db);
  return {
    async listStores() {
      return value(await commands.listStores()).filter(s => s.id === "blr-01" || s.id === "mys-01").map(s => {
        if (s.city !== "Bengaluru" && s.city !== "Mysuru") throw new Error("Unknown branch city");
        return { ...s, city: s.city };
      });
    },
    async getCart(id) {
      const cart = value(await commands.getCart(guest(id)));
      return { ...cart, storeId: cart.storeId ?? "" };
    },
    async updateCart(id, storeId, lines) {
      const cart = value(await commands.putCart(guest(id), { storeId, lines }));
      return { ...cart, storeId };
    },
    async createHold(id, cartId, key) {
      const result = await commands.reserve(guest(id), { cartId, key });
      if (!result.ok && result.error.code === "STOCK_UNAVAILABLE") {
        return { ok: false, code: result.error.code, unavailableProducts: result.error.productIds ?? [] };
      }
      return { ok: true, hold: value(result) };
    },
    async getHold(id, holdId) { return value(await commands.getHold(guest(id), holdId)); },
    async releaseHold(id, holdId) { return value(await commands.releaseHold(guest(id), holdId)); },
    async confirmOrder(id, reservationId, key) { return value(await commands.placeOrder(guest(id), { reservationId, key })); },
    async getOrder(id, orderId) { return value(await commands.getOrder(guest(id), orderId)); },
    async saveInterest(id, storeId, productId) {
      value(await commands.saveInterest(guest(id), { storeId, productId }));
      const createdAt = await db.transact(async c =>
        (await c.query("SELECT created_at FROM stock_interest WHERE actor_id=$1 AND store_id=$2 AND product_id=$3",
          [id, storeId, productId])).rows[0].created_at as Date);
      return { id: [id,storeId,productId].join(":"), sessionId: id, storeId, productId, createdAt: createdAt.toISOString() };
    },
    async getProductOffers(storeId, filter = {}) {
      if (storeId !== "blr-01" && storeId !== "mys-01") return [];
      return db.transact(async c => {
        await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const now = await databaseTime(c);
        const rows = await inventoryFacts(c, storeId, null, now);
        return rows.filter(row =>
          (!filter.category || row.category === filter.category)
          && (!filter.city || row.city === filter.city)
          && (!filter.q || (row.name + " " + row.purpose).toLowerCase().includes(filter.q.toLowerCase()))
          && row.pricePaise >= (filter.minPricePaise ?? 0) && row.pricePaise <= (filter.maxPricePaise ?? Infinity)
        ).slice(0,24).map(row => {
          const category = row.category;
          if (category !== "household" && category !== "pantry" && category !== "essentials") throw new Error("Unknown catalog category");
          return { productId: row.productId, storeId, city: row.city, name: row.name, category,
            purpose: row.purpose, pricePaise: row.pricePaise, imageUrl: row.imageUrl ?? "", pack: row.pack,
            attributes: Object.fromEntries(Object.entries(row.attributes).map(([k,v]) => [k,String(v)])),
            available: row.available, inventoryVersion: row.inventoryVersion, checkedAt: now.toISOString() };
        });
      });
    },
  };
}
