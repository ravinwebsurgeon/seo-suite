import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export const loader = (_: LoaderFunctionArgs) => {
  return redirect("/app/product-sales/dashboard");
};
