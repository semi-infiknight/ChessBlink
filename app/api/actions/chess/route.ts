export const maxDuration = 300
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { ActionGetResponse, ActionPostRequest, ActionPostResponse, ActionError, ACTIONS_CORS_HEADERS, createPostResponse, MEMO_PROGRAM_ID } from "@solana/actions"
import { Transaction, TransactionInstruction, TransactionResponse, VersionedTransactionResponse, PublicKey, ComputeBudgetProgram, Connection, Message, clusterApiUrl, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js"
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token"
import { mintNFT } from './mint'
import { connectToDB } from '@/utils/database'
import State from '@/models/state'
import Tx from '@/models/tx'
import loading from '@/models/loading'
import axios from 'axios'
import { GoogleAuth, IdTokenClient } from 'google-auth-library'

async function getIdentityToken(targetAudience: string): Promise<string> {
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(targetAudience)
  const idTokenClient = client as IdTokenClient

  const tokenResponse = await idTokenClient.getRequestHeaders()
  const identityToken = tokenResponse.Authorization?.split(' ')[1]

  if (!identityToken) {
    throw new Error('Failed to retrieve identity token.')
  }

  return identityToken;
}

export const GET = async (req: Request) => {
  await connectToDB()

  let initialState = await State.findOne({ gameNumber: 1, moveNumber: 0 })

  if (!initialState) {

    initialState = new State({
      address: "1nc1nerator11111111111111111111111111111111",
      gameNumber: 1,
      moveNumber: 0,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    })

    await initialState.save()
  }

  const loadingState = await loading.findOne();

  const latestState = await State.findOne().sort({ gameNumber: -1, moveNumber: -1 })

  let title = ""
  if (latestState.fen.split(" ")[1] === "w") {
    latestState.colour = "white"
    await latestState.save()
    title = `Game #${latestState.gameNumber}: It's White's Turn`
  } else {
    latestState.colour = "black"
    await latestState.save()
    title = `Game #${latestState.gameNumber}: It's Black's Turn`
  }

  const FastApiIdentityToken = await getIdentityToken(FastApiUrl);

  const fen = latestState.fen
  const chessboardResponse = await fetch(`${FastApiUrl}/chessboard?fen=${encodeURIComponent(fen)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FastApiIdentityToken}`
    }
  })
  const chessboardResponseData = await chessboardResponse.json()
  const board = chessboardResponseData.url
  console.log("Board: ", board)

  let bet_amount = 0
  if (latestState.betAmount === undefined) {
    const betResponse = await fetch(`${FastApiUrl}/bet_amount?fen=${encodeURIComponent(fen)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FastApiIdentityToken}`
      }
    })
    const betResponseData = await betResponse.json()
    bet_amount = betResponseData.amount
    console.log("Bet Amount: ", bet_amount)

    latestState.betAmount = bet_amount
    await latestState.save()
  } else {
    bet_amount = latestState.betAmount
  }
  const label = `Bet ${bet_amount} SOL`

  const movesResponse = await fetch(`${FastApiUrl}/moves?fen=${encodeURIComponent(fen)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FastApiIdentityToken}`
    }
  })
  const movesResponseData = await movesResponse.json()
  let moves = movesResponseData.moves
  moves = moves.map((move: string) => {
    if (move.length === 5) {
      return move.slice(0, 4) + 'q';
    }
    return move;
  });
  console.log("Selected Moves: ", moves)

  const action_url = "https://checkmate.sendarcade.fun/api/actions/chess"

  const move_buttons = moves.map((move: string) => {
    const upperMove = move.toUpperCase();
    const from = upperMove.slice(0, 2);
    const to = upperMove.slice(2, 4);
    
    const label = `${from} ➔ ${to}`
  
    return {
      href: `${action_url}?move=${move}`,
      label: label
    }
  })

  console.log(fen)

  const payload: ActionGetResponse = {
    icon: board,
    title,
    label,
    description: "\nA Solana community chess, where each player makes a move as Black or White. Play with SOL; if your team wins, earn SEND.\n\nGameplay: select a Suggested Move or a Custom Move (e.g. 'F2F3' means moving the piece from F2 to F3)",
    links: {
      actions: [
        {
          href: `${action_url}?move={move}`,
          label,
          parameters: [
            {
              name: "move",
              label: "or enter your custom move here",
            }
          ]
        },
        ...move_buttons
      ]
    }
  }

  if (loadingState && loadingState.loading) {
    payload.disabled = true
    payload.error = {
      message: "Another move in progress, please wait & refresh"
    }
  }

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS
  })
}

export const OPTIONS = GET

function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

export const POST = async (req: NextRequest) => {
  await connectToDB()

  try {
    const body: ActionPostRequest = await req.json()
  
    let account: PublicKey
    try { 
      account = new PublicKey(body.account)
    } catch (err) {
      return new Response('Invalid account provided', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS
      })
    }

    const connection = new Connection(clusterApiUrl("mainnet-beta"))

    const loadingState = await loading.findOne();
    if (loadingState && loadingState.loading) {
      console.log("Loading was found to be true")
      const empty_transaction = new Transaction()
      empty_transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000
        }),
        new TransactionInstruction({
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from("tx was in progress", "utf-8"),
          keys: []
        })
      )

      empty_transaction.feePayer = account
      empty_transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

      const empty_payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction: empty_transaction,
          message: "Someone made a move before you could, please wait & refresh to see the updated board"
        }
      })

      return Response.json(empty_payload, { headers: ACTIONS_CORS_HEADERS })
    }

    await loading.findOneAndUpdate({}, { loading: true }, { upsert: true })

    const adminAccount = new PublicKey("W9YLftqKi3MhifSN9NuZDLLwLACWrcnSHQEhXNEyhuE")

    let message = "Send it!"

    const transaction = new Transaction()

    const move = req.nextUrl.searchParams.get('move')?.toLowerCase()

    const latestState = await State.findOne().sort({ gameNumber: -1, moveNumber: -1 })
    console.log("Latest State: ", latestState)
    const nextMoveNumber = latestState ? latestState.moveNumber + 1 : 1

    const bet_amount = latestState.betAmount

    const transferTx = SystemProgram.transfer({
      fromPubkey: account,
      toPubkey: adminAccount,
      // lamports: rounded
      lamports: bet_amount * LAMPORTS_PER_SOL
    })

    const FastApiIdentityToken = await getIdentityToken(FastApiUrl);

    const response = await fetch(`${FastApiUrl}/make_move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FastApiIdentityToken}`
      },
      body: JSON.stringify({ fen: latestState.fen, move })
    })

    const responseData = await response.json()
    const { fen, game_status } = responseData

    if (game_status === "INVALID MOVE") {
      message = "Invalid move! Refresh to play again"
    } else if (game_status === "Game continues") {
      message = "Time for next player's move; repost & tag for visibility."
    } else if (game_status.includes("Checkmate")) {
      message = "Congratulations! You have won"
    } else if (game_status === "Stalemate. It's a draw.") {
      message = "It's a draw!"
    } else if (game_status === "Draw (insufficient material).") {
      message = "It's a draw due to insufficient material."
    } else {
      message = game_status
    }

    let memo_message = ""
    const randomString = generateRandomString(8)
  
    if (game_status === "INVALID MOVE") {
      memo_message = `${latestState.gameNumber}_invalid_${move}_${randomString}`
      await loading.findOneAndUpdate({}, { loading: false })

    } else if (game_status === "Game continues" || game_status === "Checkmate. White wins." || game_status === "Checkmate. Black wins." || game_status === "Stalemate. It's a draw." || game_status === "Draw (insufficient material).") {
      memo_message = `${latestState.gameNumber}_${nextMoveNumber}_${move}_${randomString}`
    }
    console.log("Memo Message Created: ", memo_message)

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000
      }),
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(`${memo_message}`, "utf-8"),
        keys: []
      }),
      ...(game_status !== "INVALID MOVE" ? [transferTx] : [])
    )

    transaction.feePayer = account
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message
      },
    })

    if (game_status !== "INVALID MOVE") {
      const data_to_send = {
        memo_message,
        account: account.toBase58(),
        move,
        nextMoveNumber,
        gameNumber: latestState.gameNumber,
        fen,
        game_status,
        maxAttempts: 30
      };

      const CheckTxIdentityToken = await getIdentityToken(CheckTxUrl);

      fetch(CheckTxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CheckTxIdentityToken}`
        },
        body: JSON.stringify(data_to_send)
      })
        .then(response => response.json())
        .then(data => console.log('Check tx response:', data))
        .catch(async (err) => {
          console.error('Error invoking check tx cloud function:', err);
  
          try {
            await loading.findOneAndUpdate({}, { loading: false });
            console.log('Loading state set to false due to error.');
          } catch (updateErr) {
            console.error('Error updating loading state:', updateErr);
          }
        });

    } else {
      console.log("Invalid move, not monitoring transaction")
    }

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS })

  } catch (err) {
    await loading.findOneAndUpdate({}, { loading: false });
    console.error(err)
    return Response.json("An unknown error occured", { status: 500 })
  }
}
