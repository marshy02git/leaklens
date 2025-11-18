// app/qa/+not-found.tsx
import { Redirect } from "expo-router";
export default function QANotFound() {
  return <Redirect href="/qa" />;
}
