import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const {
      hoaName,
      hoaLogoUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      adminEmail,
      adminPassword,
      adminName
    } = await req.json()

    // Validate required fields
    if (!hoaName || !smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !adminEmail || !adminPassword || !adminName) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Check if setup is already complete
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { id: 'system' }
    })

    if (existingConfig?.setupCompleted) {
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'An admin account with this email already exists' },
        { status: 400 }
      )
    }

    // Generate JWT secret
    const jwtSecret = crypto.randomBytes(64).toString('hex')

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Hash admin password
    const hashedPassword = await hashPassword(adminPassword)

    // Create system config and admin in transaction
    await prisma.$transaction(async (tx) => {
      // Create or update system config (but don't mark as completed yet)
      await tx.systemConfig.upsert({
        where: { id: 'system' },
        create: {
          id: 'system',
          setupCompleted: false, // Will be set to true after email verification
          hoaName,
          hoaLogoUrl: hoaLogoUrl || null,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpFrom,
          appUrl: process.env.NODE_ENV === 'development'
            ? (process.env.DEVELOPMENT_URL || 'http://localhost:3000')
            : (process.env.PRODUCTION_URL || 'http://localhost:3000'),
          jwtSecret
        },
        update: {
          hoaName,
          hoaLogoUrl: hoaLogoUrl || null,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpFrom,
          jwtSecret
        }
      })

      // Create admin account (initially with LIMITED role, will be upgraded after verification)
      await tx.admin.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName,
          role: 'LIMITED' // Will be changed to FULL after email verification
        }
      })

      // Store verification token (we'll add this to Admin model)
      // For now, we'll use a simple approach and send the token directly
    })

    // Send verification email
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })

    const appUrl = process.env.NODE_ENV === 'development'
      ? (process.env.DEVELOPMENT_URL || 'http://localhost:3000')
      : (process.env.PRODUCTION_URL || 'http://localhost:3000')
    const verificationUrl = `${appUrl}/api/setup/verify?token=${verificationToken}&email=${encodeURIComponent(adminEmail)}`

    await transporter.sendMail({
      from: smtpFrom,
      to: adminEmail,
      subject: `${hoaName} - Verify Your Administrator Account`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to ${hoaName}!</h2>
          <p>Your administrator account has been created successfully.</p>
          <p>Please verify your email address to activate your account and gain full administrator access:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${verificationUrl}" style="color: #2563eb;">${verificationUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `
    })

    // Store the verification token temporarily (in memory for this session)
    // In production, you'd want to store this in the database with an expiry
    global.pendingVerifications = global.pendingVerifications || new Map()
    global.pendingVerifications.set(verificationToken, {
      email: adminEmail,
      expires: Date.now() + 3600000 // 1 hour
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Setup completion error:', error)
    return NextResponse.json(
      { error: error.message || 'Setup failed' },
      { status: 500 }
    )
  }
}
