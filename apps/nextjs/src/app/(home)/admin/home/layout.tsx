import { redirect } from "next/navigation";
import { api } from "~/trpc/server";

const Layout = async ({ children }: { children: React.ReactNode }) => {
    const user = await api.admin.getUser();

    if (!user) {
        return redirect("/admin/login");
    }

    if (user.category !== "admin") {
        return (
            <div className="flex h-full w-full items-center justify-center bg-black text-3xl text-white">
                Unauthorized
            </div>
        );
    }

    return (
        <div>{children}</div>
    )

}

export default Layout