import { OrderStatus, OrderTransition } from '../model/jerseys.enums';

/**
 * The apparel order state machine (UN-604). Pure and total.
 *
 *   draft → submitted → approved → ordered → received → issued → completed
 *
 * with cancel available from any pre-completion state. Only a `draft` accepts
 * item edits, so once an order is submitted its contents are frozen and a later
 * change means a new order — the supplier is never handed a moving target.
 */
const ALLOWED: ReadonlyMap<OrderStatus, readonly OrderStatus[]> = new Map([
  [OrderStatus.Draft, [OrderStatus.Submitted, OrderStatus.Cancelled]],
  [OrderStatus.Submitted, [OrderStatus.Approved, OrderStatus.Cancelled]],
  [OrderStatus.Approved, [OrderStatus.Ordered, OrderStatus.Cancelled]],
  [OrderStatus.Ordered, [OrderStatus.Received, OrderStatus.Cancelled]],
  [OrderStatus.Received, [OrderStatus.Issued, OrderStatus.Cancelled]],
  [OrderStatus.Issued, [OrderStatus.Completed, OrderStatus.Cancelled]],
  [OrderStatus.Completed, []],
  [OrderStatus.Cancelled, []],
]);

const TARGETS: ReadonlyMap<OrderTransition, OrderStatus> = new Map([
  [OrderTransition.Submit, OrderStatus.Submitted],
  [OrderTransition.Approve, OrderStatus.Approved],
  [OrderTransition.Order, OrderStatus.Ordered],
  [OrderTransition.Receive, OrderStatus.Received],
  [OrderTransition.Issue, OrderStatus.Issued],
  [OrderTransition.Complete, OrderStatus.Completed],
  [OrderTransition.Cancel, OrderStatus.Cancelled],
]);

export function orderTargetOf(transition: OrderTransition): OrderStatus {
  return TARGETS.get(transition) ?? OrderStatus.Draft;
}

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return (ALLOWED.get(from) ?? []).includes(to);
}

/** Whether an order still accepts item edits (draft only). */
export function isOrderEditable(status: OrderStatus): boolean {
  return status === OrderStatus.Draft;
}

export function isSubmitTarget(status: OrderStatus): boolean {
  return status === OrderStatus.Submitted;
}

export function isApproveTarget(status: OrderStatus): boolean {
  return status === OrderStatus.Approved;
}

export function isOrderTarget(status: OrderStatus): boolean {
  return status === OrderStatus.Ordered;
}

export function isReceiveTarget(status: OrderStatus): boolean {
  return status === OrderStatus.Received;
}

export function isCompleteTarget(status: OrderStatus): boolean {
  return status === OrderStatus.Completed;
}

export function isCancelTarget(status: OrderStatus): boolean {
  return status === OrderStatus.Cancelled;
}
