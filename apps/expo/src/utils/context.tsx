import { createContext } from "react";

type AppUserContextType = {
    appUser: any;
    setUserApp: (user: any) => void;
};

export const AppUserContext = createContext<AppUserContextType>({
    appUser: null,
    setUserApp: () => { },
});