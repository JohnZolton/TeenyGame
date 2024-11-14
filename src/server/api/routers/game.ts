import { z } from "zod";
import { GameStatus } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { pusher } from "~/lib/pusher";

export const gameRouter = createTRPCRouter({
  getGames: publicProcedure.query(async ({ ctx }) => {
    void ctx.db.game.deleteMany({
      where: {
        players: {
          none: {},
        },
      },
    });
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const games = await ctx.db.game.findMany({
      where: {
        status: GameStatus.waiting,
        createdAt: {
          gte: thirtyMinutesAgo,
        },
      },
      include: {
        players: true,
      },
      orderBy: {
        id: "asc",
      },
    });
    return games.filter((game) => game.players.length !== 0);
  }),

  joinGame: publicProcedure
    .input(
      z.object({
        playerId: z.string(),
        gameId: z.string(),
        image: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db.game.findFirst({
        where: {
          id: input.gameId,
          status: GameStatus.waiting,
        },
        include: {
          players: true,
        },
      });
      if (!game) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game not found or not in waiting status",
        });
      }
      const isPlayerInGame = game.players.some(
        (player) => player.id === input.playerId,
      );
      if (isPlayerInGame) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Player is already in this game",
        });
      }
      return ctx.db.game.update({
        where: {
          id: input.gameId,
        },
        data: {
          players: {
            create: {
              npub: input.playerId,
              image: input.image,
              name: input.name,
            },
          },
        },
        include: { players: true },
      });
    }),

  leaveGame: publicProcedure
    .input(
      z.object({
        gameId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { gameId, userId } = input;

      // Find the game and associated players
      const game = await ctx.db.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game) {
        throw new Error("Game not found");
      }

      // Check if the player exists in the game
      const playerExists = game.players.some((player) => player.id === userId);
      if (!playerExists) {
        throw new Error("Player not found in this game");
      }

      // Remove the player from the game
      await ctx.db.player.delete({
        where: { id: userId },
      });

      // Check if there are any players left in the game
      const remainingPlayers = await ctx.db.player.count({
        where: { gameId },
      });

      // If no players are left, delete the game
      if (remainingPlayers === 0) {
        await ctx.db.game.delete({
          where: { id: gameId },
        });
      }

      return { success: true };
    }),
  finishGame: publicProcedure
    .input(
      z.object({
        gameId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      //TODO make this secure
      return ctx.db.game.update({
        where: { id: input.gameId },
        data: {
          status: GameStatus.finished,
        },
      });
    }),

  makeGame: publicProcedure
    .input(
      z.object({
        playerId: z.string(),
        image: z.string().optional(),
        name: z.string().optional(),
        gameName: z.string().optional().default("Flappy-Bird"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newGame = await ctx.db.game.create({
        data: {
          status: GameStatus.waiting,
          gameName: input.gameName,
          players: {
            create: {
              npub: input.playerId,
              name: input.name,
              image: input.image,
            },
          },
        },
        include: {
          players: true,
        },
      });
      console.log(newGame);
      void pusher.trigger("game-events", "gameCreated", newGame);
      return newGame;
    }),
});
