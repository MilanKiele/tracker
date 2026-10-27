"use client";
import { OnboardingForm as Form } from "./v2/account";
import { FeedbackProvider } from "./v2/ui";
export function OnboardingForm() {
  return (
    <FeedbackProvider>
      <Form />
    </FeedbackProvider>
  );
}
