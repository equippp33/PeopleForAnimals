// app/index.tsx
import { useContext } from "react";
import { Redirect } from "expo-router";

import { api } from "~/utils/api";
import { AppUserContext } from "~/utils/context";

export default function Index() {
  const { appUser } = useContext(AppUserContext);

  const user = api.user.getCurrentUser.useQuery(undefined, {
    enabled: !!appUser,
  });

  if (appUser) {
    if (appUser.category === "surgical team") {
      console.log("current session user", appUser.id && user.data?.id);
      return <Redirect href="/ABC/surgicalScreens" />;
    } else if (appUser.category === "shelter team") {
      console.log("current session user", appUser.id && user.data?.id);
      return <Redirect href="/ABC/shelterScreens" />;
    } else if (appUser.category === "operational team") {
      console.log("current session user", appUser.id && user.data?.id);
      return <Redirect href="/ABC/operationalScreens" />;
    }
  } else {
    return <Redirect href="/(auth)" />;
  }
}
