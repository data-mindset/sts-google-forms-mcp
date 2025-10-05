/**
 * Google Forms MCP Server
 * A Model Context Protocol server for creating and managing Google Forms
 * 
 * This server provides tools for:
 * - Creating new Google Forms
 * - Adding text and multiple choice questions
 * - Retrieving form details and responses
 * 
 * To run your server, run "npm run dev"
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

// Configuration schema for Google Forms MCP server
export const configSchema = z.object({
	googleClientId: z.string().describe("Google OAuth2 Client ID"),
	googleClientSecret: z.string().describe("Google OAuth2 Client Secret"),
	googleRefreshToken: z.string().describe("Google OAuth2 Refresh Token"),
	debug: z.boolean().default(false).describe("Enable debug logging"),
})

export default function createServer({
	config,
}: {
	config: z.infer<typeof configSchema>
}) {
	const server = new McpServer({
		name: "Google Forms MCP Server",
		version: "1.0.0",
	})

	// Initialize OAuth2 client
	const oauth2Client = new google.auth.OAuth2(
		config.googleClientId,
		config.googleClientSecret
	)
	oauth2Client.setCredentials({
		refresh_token: config.googleRefreshToken
	})

	// Initialize Google Forms API
	const forms = google.forms({
		version: 'v1',
		auth: oauth2Client
	})

	// Tool: Create a new Google Form
	server.registerTool(
		"create_form",
		{
			title: "Create Google Form",
			description: "Create a new Google Form with a title and optional description",
			inputSchema: {
				title: z.string().describe("Title of the form"),
				description: z.string().optional().describe("Description of the form (optional)"),
			},
		},
		async ({ title, description }) => {
			try {
				const form: any = {
					info: {
						title: title,
						documentTitle: title,
					}
				}

				if (description) {
					form.info.description = description
				}

				const response = await forms.forms.create({
					requestBody: form,
				})

				const formId = response.data.formId
				const responderUri = `https://docs.google.com/forms/d/${formId}/viewform`

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								formId,
								title: title,
								description: description || '',
								responderUri,
							}, null, 2),
						},
					],
				}
			} catch (error: any) {
				if (config.debug) {
					console.error('Error creating form:', error)
				}
				return {
					content: [
						{
							type: "text",
							text: `Error creating form: ${error.message || 'Unknown error'}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool: Add a text question to the form
	server.registerTool(
		"add_text_question",
		{
			title: "Add Text Question",
			description: "Add a text question to an existing Google Form",
			inputSchema: {
				formId: z.string().describe("Form ID"),
				questionTitle: z.string().describe("Title of the question"),
				required: z.boolean().optional().describe("Whether it is required (optional, default is false)"),
			},
		},
		async ({ formId, questionTitle, required = false }) => {
			try {
				const updateRequest = {
					requests: [
						{
							createItem: {
								item: {
									title: questionTitle,
									questionItem: {
										question: {
											required: required,
											textQuestion: {}
										}
									}
								},
								location: {
									index: 0
								}
							}
						}
					]
				}

				await forms.forms.batchUpdate({
					formId: formId,
					requestBody: updateRequest,
				})

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: true,
								message: 'Text question added successfully',
								questionTitle: questionTitle,
								required: required,
							}, null, 2),
						},
					],
				}
			} catch (error: any) {
				if (config.debug) {
					console.error('Error adding text question:', error)
				}
				return {
					content: [
						{
							type: "text",
							text: `Error adding text question: ${error.message || 'Unknown error'}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool: Add a multiple choice question to the form
	server.registerTool(
		"add_multiple_choice_question",
		{
			title: "Add Multiple Choice Question",
			description: "Add a multiple choice question to an existing Google Form",
			inputSchema: {
				formId: z.string().describe("Form ID"),
				questionTitle: z.string().describe("Title of the question"),
				options: z.array(z.string()).describe("Array of options"),
				required: z.boolean().optional().describe("Whether it is required (optional, default is false)"),
			},
		},
		async ({ formId, questionTitle, options, required = false }) => {
			try {
				const choices = options.map((option: string) => ({
					value: option
				}))

				const updateRequest = {
					requests: [
						{
							createItem: {
								item: {
									title: questionTitle,
									questionItem: {
										question: {
											required: required,
											choiceQuestion: {
												type: 'RADIO',
												options: choices,
											}
										}
									}
								},
								location: {
									index: 0
								}
							}
						}
					]
				}

				await forms.forms.batchUpdate({
					formId: formId,
					requestBody: updateRequest,
				})

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: true,
								message: 'Multiple choice question added successfully',
								questionTitle: questionTitle,
								options: options,
								required: required,
							}, null, 2),
						},
					],
				}
			} catch (error: any) {
				if (config.debug) {
					console.error('Error adding multiple choice question:', error)
				}
				return {
					content: [
						{
							type: "text",
							text: `Error adding multiple choice question: ${error.message || 'Unknown error'}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool: Get form details
	server.registerTool(
		"get_form",
		{
			title: "Get Form Details",
			description: "Get detailed information about a Google Form",
			inputSchema: {
				formId: z.string().describe("Form ID"),
			},
		},
		async ({ formId }) => {
			try {
				const response = await forms.forms.get({
					formId: formId,
				})

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response.data, null, 2),
						},
					],
				}
			} catch (error: any) {
				if (config.debug) {
					console.error('Error getting form:', error)
				}
				return {
					content: [
						{
							type: "text",
							text: `Error getting form: ${error.message || 'Unknown error'}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool: Get form responses
	server.registerTool(
		"get_form_responses",
		{
			title: "Get Form Responses",
			description: "Get all responses for a Google Form",
			inputSchema: {
				formId: z.string().describe("Form ID"),
			},
		},
		async ({ formId }) => {
			try {
				const response = await forms.forms.responses.list({
					formId: formId,
				})

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response.data, null, 2),
						},
					],
				}
			} catch (error: any) {
				if (config.debug) {
					console.error('Error getting form responses:', error)
				}
				return {
					content: [
						{
							type: "text",
							text: `Error getting form responses: ${error.message || 'Unknown error'}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	return server.server
}
