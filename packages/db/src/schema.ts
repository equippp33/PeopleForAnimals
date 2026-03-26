// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  pgTableCreator,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `${name}`);

export const vehicleDataTable = pgTable("vehicle_data", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  date: timestamp("date").defaultNow().notNull(),
  vehicleReading: text("vehicle_reading").notNull(),
  imageId: text("image_id").notNull(),
  userId: uuid("user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  hi_name: text("hi_name"),
  te_name: text("te_name"),
  email: text("email"),
  phoneNumber: text("phone_number"),
  password: text("password"),
  category: text("category", {
    enum: ["admin", "operational team", "surgical team", "shelter team"],
  }),
  role: text("role", {
    enum: ["driver", "catcher", "surgeon", "medical assistant"],
  }),
  vehicleNumber: text("vehicle_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  active: boolean("active").notNull().default(true),
});

export const otpMessages = createTable("otp_messages", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phone: text("phone_number"),
  otp: integer("otp").notNull(),
  expireAt: timestamp("expire_at").defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Table to store password reset OTPs for email-based admin password reset
export const passwordResetOtps = createTable(
  "password_reset_otps",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    otp: integer("otp").notNull(),
    expireAt: timestamp("expire_at").defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      emailUnique: uniqueIndex("password_reset_email_unique").on(table.email),
    };
  },
);

export const sessionsTable = createTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const vehicleTable = createTable("vehicle", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name"),

  vehicleNumber: text("vehicle_number"),
  vehicleColor: text("vehicle_type"),
  locationCoordinates: text("location_coordinates"),
  locationName: text("location_name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const teamsTable = createTable("teams", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  vehicleId: uuid("vehicle_id").references(() => vehicleTable.id),
  members: json("members").notNull().$type<
    {
      id: string;
      name: string;
      role: string;
      category: string;
    }[]
  >(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const circlesTable = createTable("circles", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locationsTable.id),
  name: text("name").notNull(),
  teCircleName: text("te_circlename"),
  hiCircleName: text("hi_circlename"),
  coordinates: json("coordinates").notNull().$type<{
    lat: number;
    lng: number;
  }>(),
  volunteers: json("volunteers").notNull().$type<
    {
      name: string;
      phoneNumber: string;
      hiName?: string;
      teName?: string;
    }[]
  >(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const locationsTable = createTable("locations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  te_name: text("te_name"),
  hi_name: text("hi_name"),
  type: text("type").notNull(),
  area: text("area").notNull(),
  notes: text("notes"),
  te_notes: text("te_notes"),
  hi_notes: text("hi_notes"),
  coordinates: json("coordinates").notNull().$type<{
    lat: number;
    lng: number;
  }>(),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const operationTasksTable = createTable("operation_tasks", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: uuid("vehicle_id").references(() => vehicleTable.id),
  teamId: uuid("team_id").references(() => teamsTable.id),
  taskType: text("task_type").notNull(),
  locationId: uuid("location_id").references(() => locationsTable.id),
  circleId: uuid("circle_id").references(() => circlesTable.id),
  status: text("status").default("pending"),
  isAutomatic: boolean("is_automatic").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const operationTasksRelations = relations(
  operationTasksTable,
  ({ one }) => ({
    location: one(locationsTable, {
      fields: [operationTasksTable.locationId],
      references: [locationsTable.id],
    }),
    circle: one(circlesTable, {
      fields: [operationTasksTable.circleId],
      references: [circlesTable.id],
    }),
    team: one(teamsTable, {
      fields: [operationTasksTable.teamId],
      references: [teamsTable.id],
    }),
    vehicle: one(vehicleTable, {
      fields: [operationTasksTable.vehicleId],
      references: [vehicleTable.id],
    }),
  }),
);

export const releaseTasksTable = createTable("release_tasks", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batchesTable.id),
  batchNumber: text("batch_number").notNull(),
  vehicleId: uuid("vehicle_id").references(() => vehicleTable.id),
  teamId: uuid("team_id").references(() => teamsTable.id),
  locationId: uuid("location_id").references(() => locationsTable.id),
  circleId: uuid("circle_id").references(() => circlesTable.id),
  status: text("status").default("pending"),
  isAutomatic: boolean("is_automatic").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const releaseTasksRelations = relations(
  releaseTasksTable,
  ({ one }) => ({
    batch: one(batchesTable, {
      fields: [releaseTasksTable.batchId],
      references: [batchesTable.id],
    }),
    team: one(teamsTable, {
      fields: [releaseTasksTable.teamId],
      references: [teamsTable.id],
    }),
    vehicle: one(vehicleTable, {
      fields: [releaseTasksTable.vehicleId],
      references: [vehicleTable.id],
    }),
    location: one(locationsTable, {
      fields: [releaseTasksTable.locationId],
      references: [locationsTable.id],
    }),
    circle: one(circlesTable, {
      fields: [releaseTasksTable.circleId],
      references: [circlesTable.id],
    }),
  }),
);

export const surgicalTasksTable = createTable("surgical_tasks", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  batch: text("batch").notNull(),
  teamId: uuid("team_id").references(() => teamsTable.id),
  dogId: uuid("dog_id").references(() => capturedDogsTable.id),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const tasksTable = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["pending", "in_progress", "completed"] })
    .notNull()
    .default("pending"),
  priority: text("priority", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  assignedTo: uuid("assigned_to").references(() => usersTable.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const capturedDogsTable = pgTable("captured_dogs", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  operationTaskId: uuid("operation_task_id").references(
    () => operationTasksTable.id,
  ),
  batchId: uuid("batch_id").references(() => batchesTable.id),
  dogImageUrl: text("dog_image_url").notNull(),
  gender: text("gender").notNull(),
  location: text("location"),
  coordinates: jsonb("coordinates"),
  fullAddress: text("full_address"),
  status: text("status").default("captured"),
  // New fields for dog release information
  releaseStatus: text("release_status"),
  releasePhoto: text("release_photo"),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  feederName: text("feeder_name"),
  feederPhoneNumber: text("feeder_phone_number"),
  dogColor: text("dog_color"),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  block: text("block"),
  cageNo: text("cage_no"),
  surgeryStatus: text("surgery_status", { enum: ["yes", "no"] }),
  surgeryReason: text("surgery_reason"),
  surgery_remarks: text("surgery_remarks"),
  shelterProcessedAt: timestamp("shelter_processed_at", { mode: "date" }),
  dog_tag_id: text("dog_tag_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const batchesTable = createTable("batches", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  batchNumber: text("batch_number").notNull(),
  operationTaskId: uuid("operation_task_id")
    .notNull()
    .references(() => operationTasksTable.id),
  teamId: uuid("team_id").references(() => teamsTable.id),
  vehicleId: uuid("vehicle_id").references(() => vehicleTable.id),
  userId: uuid("user_id").references(() => usersTable.id),
  status: text("status", {
    enum: ["active", "completed", "cancelled"],
  }).default("active"),
  startTime: timestamp("start_time", { withTimezone: true }).defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  totalDogs: integer("total_dogs").default(0),
  ward_supervisor_name: text("ward_supervisor_name"),
  ward_supervisor_photo: text("ward_supervisor_photo"),
  ward_supervisor_signature: text("ward_supervisor_signature"),
  capture_supervisor_name: text("capture_supervisor_name"),
  capture_supervisor_photo: text("capture_supervisor_photo"),
  capture_supervisor_signature: text("capture_supervisor_signature"),
  release_supervisor_name: text("release_supervisor_name"),
  release_supervisor_photo: text("release_supervisor_photo"),
  release_supervisor_signature: text("release_supervisor_signature"),
  shelter_task_status: text("shelter_task_status", {
    enum: ["pending", "in_progress", "completed"],
  }).default("pending"),
  surgical_task_status: text("surgical_task_status", {
    enum: ["pending", "in_progress", "completed"],
  }).default("pending"),
  surgery_task_completed: timestamp("surgery_task_completed"),
  dogsReceived: integer("dogs_received"),
  released_dogs: integer("released_dogs"),
  doctor_name: text("doctor_name"),
  doctor_photo: text("doctor_photo"),
  doctor_signature: text("doctor_signature"),
  release_date: timestamp("release_date"),
  release_status: text("release_status", {
    enum: ["pending", "due", "completed"],
  }).default("pending"),
  batch_release_remarks: text("batch_release_remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Add relations for batches
export const batchesRelations = relations(batchesTable, ({ one }) => ({
  team: one(teamsTable, {
    fields: [batchesTable.teamId],
    references: [teamsTable.id],
  }),
  vehicle: one(vehicleTable, {
    fields: [batchesTable.vehicleId],
    references: [vehicleTable.id],
  }),
  user: one(usersTable, {
    fields: [batchesTable.userId],
    references: [usersTable.id],
  }),
}));

// New table for vehicle readings
export const vehicleReadingsTable = pgTable("vehicle_readings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  imageUrl: text("image_url").notNull(),
  reading: numeric("reading").notNull(),
  readingDate: timestamp("reading_date", { withTimezone: true }).notNull(),
  vehicleId: uuid("vehicle_id").references(() => vehicleTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Relations for vehicle_readings
export const vehicleReadingsRelations = relations(
  vehicleReadingsTable,
  ({ one }) => ({
    vehicle: one(vehicleTable, {
      fields: [vehicleReadingsTable.vehicleId],
      references: [vehicleTable.id],
    }),
  }),
);

// Add relations
export const locationsRelations = relations(locationsTable, ({ many }) => ({
  circles: many(circlesTable),
}));

export const circlesRelations = relations(circlesTable, ({ one, many }) => ({
  location: one(locationsTable, {
    fields: [circlesTable.locationId],
    references: [locationsTable.id],
  }),
  operationTasks: many(operationTasksTable),
}));

/* -------------------------------------------------------------------------- */
/*                             ARV MODULE TABLES                              */
/* -------------------------------------------------------------------------- */

// Campaign spanning multiple vaccination drives
export const arvCampaignsTable = createTable("arv_campaigns", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  totalDogs: integer("total_dogs").default(0),
});

// Individual vaccination drive under a campaign
export const arvDrivesTable = createTable("arv_drives", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  campaignId: uuid("campaign_id").references(() => arvCampaignsTable.id),
  driveNumber: text("drive_number").notNull(),
  location: json("location").$type<{ lat: number; lng: number }>(),
  locationLabel: text("location_label"),
  assignedDate: timestamp("assigned_date", { withTimezone: true }),
  leaders: json("leaders").$type<{ name: string; phoneNumber: string }[]>(),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  /** Array of waypoints recorded during the drive */
  route: json("route").$type<{ lat: number; lng: number }[]>(),
  /** First point of route */
  startPoint: json("start_point").$type<{ lat: number; lng: number }>(),
  /** Last point of route */
  endPoint: json("end_point").$type<{ lat: number; lng: number }>(),
  totalDogs: integer("total_dogs").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export const driveLeadersTable = createTable("drive_leaders", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  driveId: uuid("drive_id").references(() => arvDrivesTable.id),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  location: json("location").$type<{ lat: number; lng: number }>(),
  dogsVaccinated: integer("dogs_vaccinated").default(0),
  startTimestamp: timestamp("start_timestamp", { withTimezone: true }),
  endTimestamp: timestamp("end_timestamp", { withTimezone: true }),
  waypoints: json("waypoints").$type<{ lat: number; lng: number }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Dogs vaccinated during the drives
export const arvDogsTable = createTable("arv_dogs", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  driveId: uuid("drive_id").references(() => arvDrivesTable.id),
  capturedBy: text("captured_by"), // Store user name directly as text
  capturedLocation: json("captured_location").$type<{
    lat: number;
    lng: number;
  }>(),
  photo: text("photo"),
  gender: text("gender", { enum: ["male", "female", "unknown"] }),
  ownership: text("ownership"),
  age: text("age", { enum: ["adult", "puppy"] }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* -------------------------------- Relations ------------------------------- */
export const arvCampaignsRelations = relations(
  arvCampaignsTable,
  ({ many }) => ({
    drives: many(arvDrivesTable),
  }),
);

export const arvDrivesRelations = relations(
  arvDrivesTable,
  ({ one, many }) => ({
    campaign: one(arvCampaignsTable, {
      fields: [arvDrivesTable.campaignId],
      references: [arvCampaignsTable.id],
    }),
    leaders: many(driveLeadersTable),
    dogs: many(arvDogsTable),
  }),
);

export const driveLeadersRelations = relations(
  driveLeadersTable,
  ({ one }) => ({
    drive: one(arvDrivesTable, {
      fields: [driveLeadersTable.driveId],
      references: [arvDrivesTable.id],
    }),
  }),
);

export const arvDogsRelations = relations(arvDogsTable, ({ one }) => ({
  drive: one(arvDrivesTable, {
    fields: [arvDogsTable.driveId],
    references: [arvDrivesTable.id],
  }),
  // Removed capturer relation since capturedBy is now just text
}));
