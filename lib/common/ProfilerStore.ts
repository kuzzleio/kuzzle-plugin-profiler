import { Chrono } from "./Chrono";
import { ProfilerRecord } from "./ProfilerRecord";
import { StackBuilder } from "./Stackbuilder";

export type ProfilerStore = {
  id: string;
  chrono: Chrono;
  stack: StackBuilder<ProfilerRecord>;
};