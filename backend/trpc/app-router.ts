import { createTRPCRouter } from "./create-context";
import hiProcedure, { hiTestProcedure, hiProtectedProcedure } from "./routes/example/hi/route";
import { getConversationsProcedure } from "./routes/conversations/get-conversations/route";
import { sendMessageProcedure } from "./routes/conversations/send-message/route";
import { createConversationProcedure } from "./routes/conversations/create-conversation/route";
import { getMessagesProcedure } from "./routes/conversations/get-messages/route";
import { saveWalkSessionProcedure } from "./routes/walks/save-walk-session/route";
import { getWalkHistoryProcedure } from "./routes/walks/get-walk-history/route";
import { createWalkScheduleProcedure } from "./routes/walks/create-walk-schedule/route";
import { getWalkSchedulesProcedure } from "./routes/walks/get-walk-schedules/route";
import { updateWalkScheduleProcedure } from "./routes/walks/update-walk-schedule/route";
import { joinWalkProcedure } from "./routes/walks/join-walk/route";
import { leaveWalkProcedure } from "./routes/walks/leave-walk/route";
import { getWalkStatsProcedure } from "./routes/walks/get-walk-stats/route";
import { getUserStatsProcedure } from "./routes/walks/get-user-stats/route";
import { updateUserStatsProcedure } from "./routes/walks/update-user-stats/route";
import { subscribeScheduleUpdatesProcedure } from "./routes/walks/subscribe-schedule-updates/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiProcedure,
    test: hiTestProcedure,
    testProtected: hiProtectedProcedure,
  }),
  conversations: createTRPCRouter({
    getConversations: getConversationsProcedure,
    sendMessage: sendMessageProcedure,
    createConversation: createConversationProcedure,
    getMessages: getMessagesProcedure,
  }),
  walks: createTRPCRouter({
    saveSession: saveWalkSessionProcedure,
    getHistory: getWalkHistoryProcedure,
    getStats: getWalkStatsProcedure,
    getUserStats: getUserStatsProcedure,
    updateUserStats: updateUserStatsProcedure,
    createSchedule: createWalkScheduleProcedure,
    getSchedules: getWalkSchedulesProcedure,
    updateSchedule: updateWalkScheduleProcedure,
    joinWalk: joinWalkProcedure,
    leaveWalk: leaveWalkProcedure,
    subscribeScheduleUpdates: subscribeScheduleUpdatesProcedure,
  }),
});

export type AppRouter = typeof appRouter;