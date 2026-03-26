import { adminRouter } from "./router/admin";
import { authRouter } from "./router/auth";
import { dashboardRouter } from "./router/dashboard";
import { dogsRouter } from "./router/dogs";
import { locationRouter } from "./router/location";
import { shelterRouter } from "./router/shelter";
import { surgeryRouter } from "./router/surgery";
import { taskRouter } from "./router/task";
import { teamRouter } from "./router/team";
import { userRouter } from "./router/user";
import { vehicleRouter } from "./router/vehicle";
import { vehicleDataRouter } from "./router/vehicleData";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  location: locationRouter,
  admin: adminRouter,
  vehicle: vehicleRouter,
  vehicleData: vehicleDataRouter,
  team: teamRouter,
  task: taskRouter,
  dogs: dogsRouter,
  shelter: shelterRouter,
  surgery: surgeryRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
