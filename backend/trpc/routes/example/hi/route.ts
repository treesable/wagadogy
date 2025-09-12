import { z } from "zod";
import { publicProcedure, protectedProcedure } from "../../../create-context";

export default publicProcedure
  .input(z.object({ name: z.string() }))
  .mutation(({ input }: { input: { name: string } }) => {
    console.log('[hiProcedure] Public hi endpoint called with name:', input.name);
    return {
      hello: input.name,
      date: new Date(),
      status: 'working'
    };
  });

export const hiTestProcedure = publicProcedure.query(() => {
  console.log('[hiTestProcedure] Test endpoint called');
  return {
    message: 'tRPC connection working!',
    timestamp: new Date().toISOString(),
    status: 'ok'
  };
});

export const hiProtectedProcedure = protectedProcedure.query(({ ctx }) => {
  console.log('[hiProtectedProcedure] Protected test endpoint called for user:', ctx.user.id);
  return {
    message: `Hello ${ctx.user.email}!`,
    userId: ctx.user.id,
    timestamp: new Date().toISOString(),
    status: 'authenticated'
  };
});