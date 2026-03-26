import { relations } from "drizzle-orm";

import {
  capturedDogsTable,
  operationTasksTable,
  tasksTable,
  teamsTable,
  usersTable,
  vehicleTable,
} from "./schema";

export const vehicleRelations = relations(vehicleTable, ({ one }) => ({
  team: one(teamsTable, {
    fields: [vehicleTable.id],
    references: [teamsTable.vehicleId],
  }),
}));

export const teamRelations = relations(teamsTable, ({ one }) => ({
  vehicle: one(vehicleTable, {
    fields: [teamsTable.vehicleId],
    references: [vehicleTable.id],
  }),
}));

export const tasksRelations = relations(tasksTable, ({ one }) => ({
  assignedUser: one(usersTable, {
    fields: [tasksTable.assignedTo],
    references: [usersTable.id],
  }),
}));

export const capturedDogsRelations = relations(
  capturedDogsTable,
  ({ one }) => ({
    operationTask: one(operationTasksTable, {
      fields: [capturedDogsTable.operationTaskId],
      references: [operationTasksTable.id],
    }),
  }),
);
