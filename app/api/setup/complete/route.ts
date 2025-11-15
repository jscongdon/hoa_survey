import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { log, error as logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    log('[SETUP-COMPLETE] Starting setup completion')
    
    const {
      hoaName,
      hoaLogoUrl,
      appUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      adminEmail,
      adminPassword,
      adminName
    } = await req.json()

    log('[SETUP-COMPLETE] Received data:', { hoaName, appUrl, smtpHost, smtpPort, smtpUser, smtpFrom, adminEmail, adminName })

    // Validate required fields
    if (!hoaName || !appUrl || !smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !adminEmail || !adminPassword || !adminName) {
      log('[SETUP-COMPLETE] Missing required fields')
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    log('[SETUP-COMPLETE] Checking if setup already completed')
    
    // Check if setup is already complete
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { id: 'system' }
    })

    if (existingConfig?.setupCompleted) {
      log('[SETUP-COMPLETE] Setup already completed')
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 400 }
      )
    }

    log('[SETUP-COMPLETE] Checking if admin exists')
    
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      log('[SETUP-COMPLETE] Admin already exists')
      return NextResponse.json(
        { error: 'An admin account with this email already exists' },
        { status: 400 }
      )
    }

    log('[SETUP-COMPLETE] Generating secrets')
    
    // Generate JWT secret
    const jwtSecret = crypto.randomBytes(64).toString('hex')

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    log('[SETUP-COMPLETE] Hashing password')
    
    // Hash admin password
    const hashedPassword = await hashPassword(adminPassword)

    log('[SETUP-COMPLETE] Saving to database')
    
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
          appUrl, // Use the provided appUrl
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
          appUrl, // Update appUrl as well
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

    log('[SETUP-COMPLETE] Database updated, sending verification email')
    
    // Get the appUrl from the database (just saved)
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' },
      select: { appUrl: true }
    })
    const appUrl = config?.appUrl || (process.env.NODE_ENV === 'development'
      ? (process.env.DEVELOPMENT_URL || 'http://localhost:3000')
      : (process.env.PRODUCTION_URL || 'http://localhost:3000'))
    
    log('[SETUP-COMPLETE] Using appUrl for verification:', appUrl)
    
    try {
      // Send verification email
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 120000, // 2 minutes for actual sending
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        logger: true,
        debug: true
      })

      const verificationUrl = `${appUrl}/api/setup/verify?token=${verificationToken}&email=${encodeURIComponent(adminEmail)}`

      // Send email asynchronously to avoid timeout
      transporter.sendMail({
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
      }).then(info => {
        log('[SETUP-COMPLETE] Verification email sent:', info.messageId)
      }).catch(emailErr => {
        logError('[SETUP-COMPLETE] Failed to send verification email:', emailErr)
      })
    } catch (emailError: any) {
      logError('[SETUP-COMPLETE] Email setup error:', emailError)
      // Don't fail the whole process if email fails
    }

    log('[SETUP-COMPLETE] Storing verification token')
    
    // Store the verification token temporarily (in memory for this session)
    // In production, you'd want to store this in the database with an expiry
    global.pendingVerifications = global.pendingVerifications || new Map()
    global.pendingVerifications.set(verificationToken, {
      email: adminEmail,
      expires: Date.now() + 3600000 // 1 hour
    })

    log('[SETUP-COMPLETE] Setup completed successfully')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError('[SETUP-COMPLETE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Setup failed' },
      { status: 500 }
    )
  }
}
