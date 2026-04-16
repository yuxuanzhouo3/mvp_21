import { paymentRouter } from "@/lib/architecture-modules/layers/third-party/payment/router";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";

export function initializePaymentProviders() {
  try {
    const stripeProvider = new StripeProvider(process.env);
    paymentRouter.registerProvider("stripe", stripeProvider);

    console.log("Payment providers initialized successfully");
  } catch (error) {
    console.error("Failed to initialize payment providers:", error);
  }
}

export { paymentRouter };
