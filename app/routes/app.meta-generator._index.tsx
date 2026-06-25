import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export const loader = ({ request: _request }: LoaderFunctionArgs) => {
  return redirect("/app/meta-generator/dashboard");
};
