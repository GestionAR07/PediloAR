import "server-only";

import {
  getCustomerOrder,
  listCustomerOrders,
} from "@/application/customer/order-history";
import {
  findOrderForCustomer,
  listOrdersForCustomer,
} from "@/infrastructure/db/repositories/customer-order-repository";
import { requireActiveUser } from "@/server/auth/authorization";

const deps = { listOrdersForCustomer, findOrderForCustomer };

export async function getCustomerAccountContextApp() {
  return requireActiveUser();
}

export async function listCustomerOrdersApp() {
  const context = await requireActiveUser();
  const orders = await listCustomerOrders(context.user.id, deps);
  return { context, orders };
}

export async function getCustomerOrderApp(orderId: string) {
  const context = await requireActiveUser();
  const order = await getCustomerOrder(context.user.id, orderId, deps);
  return { context, order };
}
