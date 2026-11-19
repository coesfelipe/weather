const NOMES_VARIAVEIS = ["Temp. Máx (°C)", "Temp. Mín (°C)", "Umidade (%)", "Chuva (mm)"];

// 1. Multiplicação básica de duas matrizes quadradas (4x4 * 4x4)
function multiplicarMatrizes(A, B) {
    let C = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            let soma = 0;
            for (let k = 0; k < 4; k++) {
                soma += A[i][k] * B[k][j];
            }
            C[i][j] = soma;
        }
    }
    return C;
}

// 2. Inversa de uma matriz 4x4 (Método de Gauss-Jordan básico)
function inverterMatriz4x4(matriz) {
    // Copia a matriz original e cria a matriz identidade 4x4 ao lado
    let A = matriz.map(linha => [...linha]);
    let I = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];

    for (let i = 0; i < 4; i++) {
        // Evita divisão por zero caso dois dias seguidos tenham valores idênticos
        if (Math.abs(A[i][i]) < 1e-6) {
            A[i][i] += 1e-4;
        }

        let pivo = A[i][i];
        for (let j = 0; j < 4; j++) {
            A[i][j] /= pivo;
            I[i][j] /= pivo;
        }

        for (let k = 0; k < 4; k++) {
            if (k !== i) {
                let fator = A[k][i];
                for (let j = 0; j < 4; j++) {
                    A[k][j] -= fator * A[i][j];
                    I[k][j] -= fator * I[i][j];
                }
            }
        }
    }
    return I;
}

// 3. Descobre a Matriz M = X1 * X0^(-1) usando os 5 dias passados
function descobrirMatrizTransicao(historico) {
    // Monta X0 (colunas: dias 0, 1, 2, 3) e X1 (colunas: dias 1, 2, 3, 4)
    let X0 = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];
    let X1 = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];

    for (let col = 0; col < 4; col++) {
        for (let lin = 0; lin < 4; lin++) {
            X0[lin][col] = historico[col][lin];
            X1[lin][col] = historico[col + 1][lin];
        }
    }

    const X0_inversa = inverterMatriz4x4(X0);
    return multiplicarMatrizes(X1, X0_inversa);
}

// 4. Multiplicação básica de Matriz (4x4) por Vetor (4x1)
function multiplicarMatrizPorVetor(M, x) {
    let resultado = [0, 0, 0, 0];

    for (let i = 0; i < 4; i++) {
        let soma = 0;
        for (let j = 0; j < 4; j++) {
            soma += M[i][j] * x[j];
        }
        resultado[i] = soma;
    }

    // Mantém os valores dentro de limites físicos
    resultado[0] = Math.min(Math.max(resultado[0], -20), 50);
    resultado[1] = Math.min(Math.max(resultado[1], -25), 40);
    resultado[2] = Math.min(Math.max(resultado[2], 0), 100);
    resultado[3] = Math.max(resultado[3], 0);

    return resultado;
}

// 5. Integral Simples (Regra dos Trapézios) para somar a chuva dos 5 dias
function calcularIntegralChuva(listaChuva) {
    let areaTotal = 0;
    for (let i = 0; i < listaChuva.length - 1; i++) {
        areaTotal += (listaChuva[i] + listaChuva[i + 1]) / 2;
    }
    return areaTotal;
}

// 6. Consulta histórico recente + hoje na API Open-Meteo
async function carregarClima(lat, lon, nomeCidade) {
    document.getElementById("nomeCidade").innerText = nomeCidade;

    // Pede 5 dias passados (past_days=5) + hoje + 5 dias futuros
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum&timezone=auto&past_days=5&forecast_days=6`;

    try {
        const resposta = await fetch(url);
        const dados = await resposta.json();

        // Extrai os 6 primeiros dias (5 passados + hoje) para descobrir M
        let historico = [];
        for (let d = 0; d <= 5; d++) {
            historico.push([
                dados.daily.temperature_2m_max[d],
                dados.daily.temperature_2m_min[d],
                dados.daily.relative_humidity_2m_mean[d],
                dados.daily.precipitation_sum[d]
            ]);
        }

        // Descobre a Matriz de Transição M a partir do histórico real
        const matrizDescoberta = descobrirMatrizTransicao(historico);

        // Vetor x0 com os dados reais de HOJE (índice 5)
        const x0 = historico[5];

        // Calcula os próximos 5 dias multiplicando M pelo dia anterior
        let previsoes = [x0];
        let vetorAtual = x0;

        for (let dia = 1; dia <= 5; dia++) {
            vetorAtual = multiplicarMatrizPorVetor(matrizDescoberta, vetorAtual);
            previsoes.push(vetorAtual);
        }

        const datasFuturas = dados.daily.time.slice(5);
        mostrarNaTela(matrizDescoberta, previsoes, datasFuturas);

    } catch (erro) {
        alert("Erro ao buscar dados na API Open-Meteo.");
    }
}

// 7. Exibe a Matriz Descoberta, os Vetores, a Tabela e o Alerta
function mostrarNaTela(M, previsoes, datas) {
    // Desenha a Matriz M descoberta
    const tabelaM = document.getElementById("tabelaMatriz");
    tabelaM.innerHTML = M.map(linha =>
        `<tr>${linha.map(valor => `<td>${valor.toFixed(2)}</td>`).join("")}</tr>`
    ).join("");

    // Desenha Vetor Hoje (x0) e Amanhã (x1)
    const x0 = previsoes[0];
    const x1 = previsoes[1];

    document.getElementById("vetorHoje").innerHTML = x0.map((val, i) =>
        `<div>${NOMES_VARIAVEIS[i]}: <strong>${val.toFixed(1)}</strong></div>`
    ).join("");

    document.getElementById("vetorAmanha").innerHTML = x1.map((val, i) =>
        `<div>${NOMES_VARIAVEIS[i]}: <strong>${val.toFixed(1)}</strong></div>`
    ).join("");

    // Desenha tabela dos próximos 5 dias
    const tbody = document.getElementById("tabelaPrevisao");
    let htmlLinhas = "";
    let chuvas = [];

    for (let d = 1; d <= 5; d++) {
        const dia = previsoes[d];
        chuvas.push(dia[3]);

        htmlLinhas += `
            <tr>
                <td>${datas[d]}</td>
                <td>${dia[0].toFixed(1)} °C</td>
                <td>${dia[1].toFixed(1)} °C</td>
                <td>${dia[2].toFixed(0)} %</td>
                <td>${dia[3].toFixed(1)} mm</td>
            </tr>
        `;
    }
    tbody.innerHTML = htmlLinhas;

    // Calcula Integral da Chuva e verifica Evento Extremo
    const chuvaTotal = calcularIntegralChuva(chuvas);
    document.getElementById("valorIntegral").innerText = `${chuvaTotal.toFixed(1)} mm`;

    const maxTemp = Math.max(...previsoes.map(p => p[0]));
    const boxAlerta = document.getElementById("boxAlerta");

    if (chuvaTotal > 30 || maxTemp > 36) {
        boxAlerta.innerText = "⚠️ ALERTA: Evento Climático Extremo Previsto!";
        boxAlerta.className = "alerta perigo";
    } else {
        boxAlerta.innerText = "✓ Clima Normal (Sem eventos extremos)";
        boxAlerta.className = "alerta normal";
    }
}

// 8. Busca cidade pelo nome
document.getElementById("formBusca").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cidade = document.getElementById("cidadeInput").value.trim();
    if (!cidade) return;

    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`);
    const geo = await res.json();

    if (geo.results && geo.results.length > 0) {
        const local = geo.results[0];
        carregarClima(local.latitude, local.longitude, `${local.name}, ${local.country_code}`);
    } else {
        alert("Cidade não encontrada.");
    }
});

// Inicia com Vitória da Conquista
carregarClima(-14.8619, -40.8442, "Vitória da Conquista, BR");