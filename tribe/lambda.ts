/* eslint-disable header/header */
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({
	region: process.env.AWS_REGION || 'eu-west-3',
});

async function getOpenRouterKey() {
	const command = new GetSecretValueCommand({
		SecretId: 'OpenRouter-MightDev-API-Key',
	});

	const response = await secretsClient.send(command);
	if ('SecretString' in response) {
		const secret = JSON.parse(response.SecretString);
		return secret.open_router_api_key;
	}
	throw new Error('OpenRouter API key not found');
}

export const handler = async (event) => {
	console.log('Received event:', JSON.stringify(event));
	try {
		// Parse the body from the event
		const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

		// Extract messages from either the direct format or nested format for backward compatibility
		const messages = body?.messages || body?.body?.messages;

		if (!messages || !Array.isArray(messages)) {
			throw new Error('Invalid request format: messages array is required');
		}

		// Extract role context and self-reference flags
		const roleContext = body?.roleContext || {};
		const isSelfReferential = body?.isSelfReferential || false;

		// Add role context to system message if present
		const systemMessage = messages.find((m) => m.role === 'system');
		if (systemMessage && roleContext) {
			// Include system access information in the context
			const systemAccessInfo = roleContext.system_access || {
				learning_system: { has_access: false, access_level: null, last_verified: null },
				project_management: { has_access: false, access_level: null, last_verified: null },
				collaboration_tools: { has_access: false, access_level: null, last_verified: null },
			};

			const contextualizedContent = `${systemMessage.content}\n\nCurrent System Access Status:
- Learning System: ${JSON.stringify(systemAccessInfo.learning_system)}
- Project Management: ${JSON.stringify(systemAccessInfo.project_management)}
- Collaboration Tools: ${JSON.stringify(systemAccessInfo.collaboration_tools)}

Role Context: ${JSON.stringify(roleContext)}`;

			systemMessage.content = contextualizedContent;

			if (isSelfReferential) {
				systemMessage.content += '\nThis is a self-referential question about your role and capabilities.';
			}
		}

		// Get API key from Secrets Manager
		const apiKey = await getOpenRouterKey();

		// Call OpenRouter API
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': process.env.REFERER_URL || 'http://localhost:3000',
			},
			body: JSON.stringify({
				model: 'openrouter/auto',
				route: 'fallback',
				messages: messages,
				temperature: 0.7,
				max_tokens: 2500,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('OpenRouter API error:', response.status, errorText);
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data = await response.json();
		console.log('OpenRouter API response:', JSON.stringify(data));

		if (!data.choices || !data.choices[0] || !data.choices[0].message) {
			throw new Error('Invalid response format from OpenRouter API');
		}

		// Return the response in our expected format
		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
				'Cache-Control': 'no-cache',
			},
			body: JSON.stringify(data.choices[0].message.content),
		};
	} catch (error) {
		console.error('Error:', error);

		return {
			statusCode: error.status || 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
				'Cache-Control': 'no-cache',
			},
			body: JSON.stringify({
				error: error.message,
				details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
			}),
		};
	}
};
