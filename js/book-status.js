const STATUS_CONFIG = {
    "Em Germinação": {
        className: "status-em-germinacao",
        description: "Uma ideia concebida, ainda amadurecendo antes do desenvolvimento."
    },
    "Em Criação": {
        className: "status-em-criacao",
        description: "História em desenvolvimento, ainda sem previsão de publicação."
    },
    "Em Breve": {
        className: "status-em-breve",
        description: "Obra preparada para lançamento. Novidades serão anunciadas em breve."
    },
    "Em Andamento": {
        className: "status-em-andamento",
        description: "Publicação em andamento, com novos capítulos previstos."
    },
    "Concluída": {
        className: "status-concluido",
        description: "História finalizada e disponível para leitura."
    }
};

export function normalizeBookStatus(status) {
    if (status === "Concluído") return "Concluída";
    return STATUS_CONFIG[status] ? status : "Em Andamento";
}

export function bookStatusMarkup(status, includeDescription = false) {
    const normalized = normalizeBookStatus(status);
    const config = STATUS_CONFIG[normalized];
    return `<span class="status-badge ${config.className}">${normalized}</span>${includeDescription ? `<span class="status-description">${config.description}</span>` : ""}`;
}

export function emptyBookStatusMessage(status) {
    const normalized = normalizeBookStatus(status);
    return STATUS_CONFIG[normalized].description;
}
