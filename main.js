$(document).ready(function() {
            let movimentacoes = [];
            let estoque = [];
            let editandoItemId = null;
            const STORAGE_MOV_KEY = 'transporte_movimentacoes';
            const STORAGE_ESTOQUE_KEY = 'transporte_estoque';

            // Função para formatar data para exibição
            function formatarData(data) {
                if (!data) return '';
                const partes = data.split('-');
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
            }

            // Função para verificar status de vencimento
            function getStatusVencimento(dataVencimento) {
                const hoje = new Date();
                const vencimento = new Date(dataVencimento);
                const diffTime = vencimento - hoje;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) {
                    return { status: 'VENCIDO', classe: 'vencimento-vencido' };
                } else if (diffDays <= 30) {
                    return { status: `Vence em ${diffDays} dias`, classe: 'vencimento-proximo' };
                } else {
                    return { status: 'VÁLIDO', classe: '' };
                }
            }

            // Função para formatar valor monetário
            function formatarValor(valor) {
                if (!valor || valor === '0.00') return '';
                return parseFloat(valor).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }

            // Carregar dados do localStorage
            function carregarDados() {
                const movimentacoesSalvas = localStorage.getItem(STORAGE_MOV_KEY);
                const estoqueSalvo = localStorage.getItem(STORAGE_ESTOQUE_KEY);
                
                if (movimentacoesSalvas) {
                    movimentacoes = JSON.parse(movimentacoesSalvas);
                }
                if (estoqueSalvo) {
                    estoque = JSON.parse(estoqueSalvo);
                }
            }

            // Salvar dados no localStorage
            function salvarDados() {
                localStorage.setItem(STORAGE_MOV_KEY, JSON.stringify(movimentacoes));
                localStorage.setItem(STORAGE_ESTOQUE_KEY, JSON.stringify(estoque));
            }

            // Mostrar alerta de produto não encontrado
            function mostrarAlertaProdutoNaoEncontrado(cliente, produto, lote) {
                $('#clienteAlerta').text(cliente);
                $('#produtoAlerta').text(produto);
                $('#loteAlerta').text(lote);
                $('#produtoNaoEncontradoAlert').addClass('show');
                setTimeout(() => {
                    $('#produtoNaoEncontradoAlert').removeClass('show');
                }, 10000);
            }

            // Atualizar estoque baseado na movimentação
            function atualizarEstoque(movimentacao) {
                const { 
                    cliente,
                    produto, 
                    lote, 
                    qtde, 
                    tipoMovimentacao, 
                    dataMovimentacao,
                    dataFabricacao,
                    dataVencimento
                } = movimentacao;
                const quantidade = parseInt(qtde) || 0;
                
                if (quantidade <= 0) return;

                // Procurar produto, lote e cliente no estoque
                const indexEstoque = estoque.findIndex(item => 
                    item.produto === produto && 
                    item.lote === lote && 
                    item.cliente === cliente
                );

                if (tipoMovimentacao === 'entrada') {
                    if (indexEstoque === -1) {
                        // Novo produto/lote/cliente
                        estoque.push({
                            id: Date.now(), // ID único para edição
                            cliente: cliente,
                            produto: produto,
                            lote: lote,
                            dataFabricacao: dataFabricacao,
                            dataVencimento: dataVencimento,
                            quantidade: quantidade,
                            ultimaMovimentacao: dataMovimentacao
                        });
                    } else {
                        // Atualizar quantidade existente
                        estoque[indexEstoque].quantidade += quantidade;
                        estoque[indexEstoque].ultimaMovimentacao = dataMovimentacao;
                    }
                } else if (tipoMovimentacao === 'saida') {
                    if (indexEstoque === -1) {
                        // Produto não encontrado no estoque - mostrar alerta e NÃO registrar
                        mostrarAlertaProdutoNaoEncontrado(cliente, produto, lote);
                        return false; // Indica que a operação falhou
                    } else {
                        // Verificar se há quantidade suficiente
                        if (estoque[indexEstoque].quantidade < quantidade) {
                            alert(`Quantidade insuficiente no estoque para ${produto} (Lote: ${lote}) do cliente ${cliente}!\nEstoque atual: ${estoque[indexEstoque].quantidade}, Tentativa de saída: ${quantidade}`);
                            return false;
                        }
                        
                        estoque[indexEstoque].quantidade -= quantidade;
                        estoque[indexEstoque].ultimaMovimentacao = dataMovimentacao;
                        
                        // Remover do estoque se quantidade for 0
                        if (estoque[indexEstoque].quantidade === 0) {
                            estoque.splice(indexEstoque, 1);
                        }
                    }
                }
                return true; // Indica que a operação foi bem-sucedida
            }

            // Adicionar dados ao formulário de movimentação
            $('#dataForm').on('submit', function(e) {
                e.preventDefault();
                
                // Validar datas de fabricação e vencimento
                const dataFabricacao = $('#dataFabricacao').val();
                const dataVencimento = $('#dataVencimento').val();
                
                if (new Date(dataVencimento) < new Date(dataFabricacao)) {
                    alert('A data de vencimento não pode ser anterior à data de fabricação!');
                    return;
                }
                
                const novoDado = {
                    dataMovimentacao: $('#dataMovimentacao').val(),
                    tipoMovimentacao: $('#tipoMovimentacao').val(),
                    cte: $('#cte').val(),
                    nf: $('#nf').val(),
                    cliente: $('#cliente').val(),
                    produto: $('#produto').val(),
                    qtdePallets: $('#qtdePallets').val() || '',
                    qtde: $('#qtde').val(),
                    pesoNf: $('#pesoNf').val() || '',
                    lote: $('#lote').val(),
                    dataFabricacao: dataFabricacao,
                    dataVencimento: dataVencimento,
                    motorista: $('#motorista').val(),
                    valorNf: $('#valorNf').val() || '',
                    destino: $('#destino').val(),
                    observacoes: $('#observacoes').val() || ''
                };

                // Verificar se é saída e validar estoque
                if (novoDado.tipoMovimentacao === 'saida') {
                    const sucesso = atualizarEstoque(novoDado);
                    if (!sucesso) {
                        return; // Não adicionar ao array de movimentações se falhou
                    }
                } else {
                    // Para entrada, sempre atualiza o estoque
                    atualizarEstoque(novoDado);
                }

                movimentacoes.push(novoDado);
                salvarDados();
                aplicarFiltros();
                atualizarTabelasEstoque();
                $('#dataForm')[0].reset();
                $('#tipoMovimentacao').val('');
                
                // Resetar datas para hoje
                const hoje = new Date().toISOString().split('T')[0];
                $('#dataMovimentacao').val(hoje);
                $('#dataFabricacao').val(hoje);
                const umAnoDepois = new Date();
                umAnoDepois.setFullYear(umAnoDepois.getFullYear() + 1);
                $('#dataVencimento').val(umAnoDepois.toISOString().split('T')[0]);
            });

            // Adicionar/editar produto no estoque diretamente
            $('#estoqueForm').on('submit', function(e) {
                e.preventDefault();
                
                const dataFabricacao = $('#estoqueFabricacao').val();
                const dataVencimento = $('#estoqueVencimento').val();
                
                if (new Date(dataVencimento) < new Date(dataFabricacao)) {
                    alert('A data de vencimento não pode ser anterior à data de fabricação!');
                    return;
                }
                
                const cliente = $('#estoqueCliente').val();
                const produto = $('#estoqueProduto').val();
                const lote = $('#estoqueLote').val();
                const quantidade = parseInt($('#estoqueQuantidade').val());
                const fabricacao = dataFabricacao;
                const vencimento = dataVencimento;
                
                if (editandoItemId === null) {
                    // Adicionar novo produto
                    const novoProduto = {
                        id: Date.now(),
                        cliente: cliente,
                        produto: produto,
                        lote: lote,
                        dataFabricacao: fabricacao,
                        dataVencimento: vencimento,
                        quantidade: quantidade,
                        ultimaMovimentacao: new Date().toISOString().split('T')[0]
                    };
                    estoque.push(novoProduto);
                } else {
                    // Editar produto existente
                    const index = estoque.findIndex(item => item.id === editandoItemId);
                    if (index !== -1) {
                        estoque[index].cliente = cliente;
                        estoque[index].produto = produto;
                        estoque[index].lote = lote;
                        estoque[index].dataFabricacao = fabricacao;
                        estoque[index].dataVencimento = vencimento;
                        estoque[index].quantidade = quantidade;
                        estoque[index].ultimaMovimentacao = new Date().toISOString().split('T')[0];
                    }
                    editandoItemId = null;
                    $('#cancelarEdicao').hide();
                }
                
                salvarDados();
                atualizarTabelasEstoque();
                $('#estoqueForm')[0].reset();
            });

            // Cancelar edição
            $('#cancelarEdicao').on('click', function() {
                editandoItemId = null;
                $(this).hide();
                $('#estoqueForm')[0].reset();
            });

            // Função para renderizar a tabela de movimentações
            function renderizarTabelaMovimentacoes(dadosFiltrados) {
                const tbody = $('#dataTableBody');
                tbody.empty();

                if (dadosFiltrados.length === 0) {
                    tbody.append('<tr><td colspan="9" class="text-center">Nenhuma movimentação encontrada</td></tr>');
                    return;
                }

                dadosFiltrados.forEach((dado, index) => {
                    const tipoClasse = dado.tipoMovimentacao === 'entrada' ? 'tipo-entrada' : 'tipo-saida';
                    const tipoTexto = dado.tipoMovimentacao === 'entrada' ? 'ENTRADA' : 'SAÍDA';
                    const observacoes = dado.observacoes || '';
                    
                    const row = `
                        <tr class="${tipoClasse}">
                            <td>${formatarData(dado.dataMovimentacao)}</td>
                            <td><strong>${tipoTexto}</strong></td>
                            <td>${dado.cliente}</td>
                            <td>${dado.produto}</td>
                            <td>${dado.qtde}</td>
                            <td>${dado.lote}</td>
                            <td>${formatarData(dado.dataVencimento)}</td>
                            <td class="observacao-cell" title="${observacoes}">${observacoes}</td>
                            <td>
                                <button class="delete-btn btn-sm" data-index="${movimentacoes.indexOf(dado)}">Excluir</button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });

                // Adicionar evento de exclusão
                $('.delete-btn').on('click', function() {
                    const originalIndex = $(this).data('index');
                    const movimentacaoRemovida = movimentacoes[originalIndex];
                    
                    // Remover do array
                    movimentacoes.splice(originalIndex, 1);
                    
                    // Atualizar estoque de acordo com a exclusão
                    if (movimentacaoRemovida.tipoMovimentacao === 'entrada') {
                        // Remover a quantidade que foi adicionada
                        const indexEstoque = estoque.findIndex(item => 
                            item.produto === movimentacaoRemovida.produto && 
                            item.lote === movimentacaoRemovida.lote && 
                            item.cliente === movimentacaoRemovida.cliente
                        );
                        if (indexEstoque !== -1) {
                            estoque[indexEstoque].quantidade -= parseInt(movimentacaoRemovida.qtde);
                            if (estoque[indexEstoque].quantidade <= 0) {
                                estoque.splice(indexEstoque, 1);
                            }
                        }
                    } else if (movimentacaoRemovida.tipoMovimentacao === 'saida') {
                        // Adicionar de volta a quantidade que foi removida
                        const indexEstoque = estoque.findIndex(item => 
                            item.produto === movimentacaoRemovida.produto && 
                            item.lote === movimentacaoRemovida.lote && 
                            item.cliente === movimentacaoRemovida.cliente
                        );
                        if (indexEstoque !== -1) {
                            estoque[indexEstoque].quantidade += parseInt(movimentacaoRemovida.qtde);
                        } else {
                            // Se não existir no estoque, criar novo registro
                            estoque.push({
                                id: Date.now(),
                                cliente: movimentacaoRemovida.cliente,
                                produto: movimentacaoRemovida.produto,
                                lote: movimentacaoRemovida.lote,
                                dataFabricacao: movimentacaoRemovida.dataFabricacao,
                                dataVencimento: movimentacaoRemovida.dataVencimento,
                                quantidade: parseInt(movimentacaoRemovida.qtde),
                                ultimaMovimentacao: new Date().toISOString().split('T')[0]
                            });
                        }
                    }
                    
                    salvarDados();
                    aplicarFiltros();
                    atualizarTabelasEstoque();
                });
            }

            // Função para atualizar estoque geral
            function atualizarEstoqueGeral() {
                const tbody = $('#estoqueGeralTableBody');
                const info = $('#estoqueGeralInfo');
                tbody.empty();

                if (estoque.length === 0) {
                    info.show();
                    return;
                }

                info.hide();
                
                // Agrupar por produto
                const estoqueAgrupado = {};
                estoque.forEach(item => {
                    const chave = `${item.produto}`;
                    if (!estoqueAgrupado[chave]) {
                        estoqueAgrupado[chave] = {
                            produto: item.produto,
                            totalQuantidade: 0,
                            lotes: new Set(),
                            datasVencimento: []
                        };
                    }
                    estoqueAgrupado[chave].totalQuantidade += item.quantidade;
                    estoqueAgrupado[chave].lotes.add(item.lote);
                    estoqueAgrupado[chave].datasVencimento.push(item.dataVencimento);
                });

                Object.values(estoqueAgrupado).forEach(item => {
                    // Calcular status médio baseado nas datas de vencimento
                    let statusMedio = 'VÁLIDO';
                    const hoje = new Date();
                    
                    for (const dataVenc of item.datasVencimento) {
                        const vencimento = new Date(dataVenc);
                        const diffDays = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                            statusMedio = 'VENCIDO';
                            break;
                        } else if (diffDays <= 30) {
                            statusMedio = 'VENCE EM BREVE';
                        }
                    }
                    
                    const statusClasse = statusMedio === 'VENCIDO' ? 'vencimento-vencido' : 
                                       statusMedio === 'VENCE EM BREVE' ? 'vencimento-proximo' : '';
                    
                    const row = `
                        <tr class="${statusClasse}">
                            <td>${item.produto}</td>
                            <td>${item.lotes.size} lote(s)</td>
                            <td><strong>${item.totalQuantidade}</strong></td>
                            <td>${statusMedio}</td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }

            // Função para atualizar estoque por cliente
            function atualizarEstoquePorCliente() {
                const tabsContainer = $('#clienteTabs');
                const contentContainer = $('#clienteTabContent');
                tabsContainer.empty();
                contentContainer.empty();

                if (estoque.length === 0) {
                    contentContainer.append('<div class="alert alert-info p-3 text-center">Nenhum cliente com estoque cadastrado.</div>');
                    return;
                }

                // Obter lista única de clientes
                const clientes = [...new Set(estoque.map(item => item.cliente))];
                
                clientes.forEach((cliente, index) => {
                    const activeClass = index === 0 ? 'active' : '';
                    const activeAria = index === 0 ? 'true' : 'false';
                    
                    // Adicionar tab
                    tabsContainer.append(`
                        <li class="nav-item" role="presentation">
                            <button class="nav-link ${activeClass}" id="cliente-${index}-tab" 
                                    data-bs-toggle="tab" data-bs-target="#cliente-${index}" 
                                    type="button" role="tab" aria-selected="${activeAria}">
                                <span class="cliente-badge">${cliente}</span>
                            </button>
                        </li>
                    `);
                    
                    // Adicionar conteúdo do tab
                    const estoqueCliente = estoque.filter(item => item.cliente === cliente);
                    let tableRows = '';
                    
                    estoqueCliente.forEach(item => {
                        const statusVenc = getStatusVencimento(item.dataVencimento);
                        const statusClasse = statusVenc.classe;
                        const estoqueZeroClasse = item.quantidade === 0 ? 'estoque-zero' : '';
                        const finalClasse = statusClasse ? statusClasse : estoqueZeroClasse;
                        
                        tableRows += `
                            <tr class="${finalClasse}">
                                <td>${item.produto}</td>
                                <td>${item.lote}</td>
                                <td>${formatarData(item.dataFabricacao)}</td>
                                <td>${formatarData(item.dataVencimento)}</td>
                                <td><strong>${item.quantidade}</strong></td>
                                <td>${statusVenc.status}</td>
                                <td>
                                    <button class="edit-btn btn-sm" data-id="${item.id}">Editar</button>
                                    <button class="delete-btn btn-sm" data-id="${item.id}">Excluir</button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    contentContainer.append(`
                        <div class="tab-pane fade ${activeClass} show" id="cliente-${index}" role="tabpanel">
                            <div class="card">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <h6 class="mb-0">Estoque - ${cliente}</h6>
                                        <button class="btn btn-warning btn-sm export-cliente-btn" data-cliente="${cliente}">Exportar</button>
                                    </div>
                                    <div class="table-responsive">
                                        <table class="table table-striped mb-0">
                                            <thead>
                                                <tr>
                                                    <th>PRODUTO</th>
                                                    <th>LOTE</th>
                                                    <th>FABRICAÇÃO</th>
                                                    <th>VENCIMENTO</th>
                                                    <th>QTDE</th>
                                                    <th>STATUS</th>
                                                    <th>AÇÕES</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${tableRows}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `);
                });

                // Adicionar eventos de edição e exclusão para estoque
                $('.edit-btn').on('click', function() {
                    const id = parseInt($(this).data('id'));
                    const item = estoque.find(item => item.id === id);
                    if (item) {
                        $('#estoqueCliente').val(item.cliente);
                        $('#estoqueProduto').val(item.produto);
                        $('#estoqueLote').val(item.lote);
                        $('#estoqueQuantidade').val(item.quantidade);
                        $('#estoqueFabricacao').val(item.dataFabricacao);
                        $('#estoqueVencimento').val(item.dataVencimento);
                        editandoItemId = id;
                        $('#cancelarEdicao').show();
                    }
                });

                $('.delete-btn').on('click', function() {
                    const id = parseInt($(this).data('id'));
                    if (confirm('Tem certeza que deseja excluir este produto do estoque?')) {
                        estoque = estoque.filter(item => item.id !== id);
                        salvarDados();
                        atualizarTabelasEstoque();
                    }
                });

                // Adicionar eventos de exportação por cliente
                $('.export-cliente-btn').on('click', function() {
                    const clienteNome = $(this).data('cliente');
                    const estoqueCliente = estoque.filter(item => item.cliente === clienteNome);
                    
                    if (estoqueCliente.length === 0) {
                        alert('Nenhum dado de estoque para este cliente!');
                        return;
                    }

                    const wsData = estoqueCliente.map(item => {
                        const statusVenc = getStatusVencimento(item.dataVencimento);
                        return {
                            'CLIENTE': item.cliente,
                            'PRODUTO': item.produto,
                            'LOTE': item.lote,
                            'DATA FABRICAÇÃO': formatarData(item.dataFabricacao),
                            'DATA VENCIMENTO': formatarData(item.dataVencimento),
                            'QUANTIDADE TOTAL': item.quantidade,
                            'STATUS VALIDADE': statusVenc.status
                        };
                    });

                    const ws = XLSX.utils.json_to_sheet(wsData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, `Estoque_${clienteNome.replace(/\s+/g, '_')}`);

                    const colWidths = [
                        {wch: 20}, // CLIENTE
                        {wch: 25}, // PRODUTO
                        {wch: 15}, // LOTE
                        {wch: 15}, // DATA FABRICAÇÃO
                        {wch: 15}, // DATA VENCIMENTO
                        {wch: 18}, // QUANTIDADE TOTAL
                        {wch: 20}  // STATUS VALIDADE
                    ];
                    ws['!cols'] = colWidths;

                    XLSX.writeFile(wb, `estoque_${clienteNome.replace(/\s+/g, '_')}.xlsx`);
                });
            }

            // Função para atualizar todas as tabelas de estoque
            function atualizarTabelasEstoque() {
                atualizarEstoqueGeral();
                atualizarEstoquePorCliente();
            }

            // Função para aplicar filtros
            function aplicarFiltros() {
                const filtroDataInicio = $('#filterDataInicio').val();
                const filtroDataFim = $('#filterDataFim').val();
                const filtroCliente = $('#filterCliente').val().toLowerCase();
                const filtroProduto = $('#filterProduto').val().toLowerCase();
                const filtroTipo = $('#filterTipo').val();

                const dadosFiltrados = movimentacoes.filter(dado => {
                    // Filtro por período
                    let dataMatch = true;
                    if (filtroDataInicio || filtroDataFim) {
                        const dataMov = new Date(dado.dataMovimentacao);
                        if (filtroDataInicio) {
                            const dataInicio = new Date(filtroDataInicio);
                            dataMatch = dataMatch && dataMov >= dataInicio;
                        }
                        if (filtroDataFim) {
                            const dataFim = new Date(filtroDataFim);
                            dataMatch = dataMatch && dataMov <= dataFim;
                        }
                    }
                    
                    const clienteMatch = !filtroCliente || dado.cliente.toLowerCase().includes(filtroCliente);
                    const produtoMatch = !filtroProduto || dado.produto.toLowerCase().includes(filtroProduto);
                    const tipoMatch = !filtroTipo || dado.tipoMovimentacao === filtroTipo;
                    
                    return dataMatch && clienteMatch && produtoMatch && tipoMatch;
                });

                renderizarTabelaMovimentacoes(dadosFiltrados);
            }

            // Eventos de filtro
            $('#applyFilter').on('click', aplicarFiltros);
            
            $('#clearFilter').on('click', function() {
                $('#filterDataInicio, #filterDataFim, #filterCliente, #filterProduto').val('');
                $('#filterTipo').val('');
                aplicarFiltros();
            });

            // Permitir filtragem ao digitar Enter
            $('.filter-section input, .filter-section select').on('keypress', function(e) {
                if (e.which === 13) {
                    aplicarFiltros();
                }
            });

            // Exportar movimentações para Excel
            $('#exportBtn').on('click', function() {
                if (movimentacoes.length === 0) {
                    alert('Nenhuma movimentação para exportar!');
                    return;
                }

                const wsData = movimentacoes.map(dado => ({
                    'DATA MOVIMENTAÇÃO': formatarData(dado.dataMovimentacao),
                    'TIPO': dado.tipoMovimentacao === 'entrada' ? 'ENTRADA' : 'SAÍDA',
                    'CT-e': dado.cte,
                    'NF': dado.nf,
                    'CLIENTE/FORNECEDOR': dado.cliente,
                    'PRODUTO': dado.produto,
                    'QTDE PALLETS': dado.qtdePallets,
                    'QTDE': dado.qtde,
                    'PESO NF': dado.pesoNf,
                    'LOTE': dado.lote,
                    'DATA FABRICAÇÃO': formatarData(dado.dataFabricacao),
                    'DATA VENCIMENTO': formatarData(dado.dataVencimento),
                    'MOTORISTA': dado.motorista,
                    'VALOR NF': dado.valorNf ? `R$ ${formatarValor(dado.valorNf)}` : '',
                    'DESTINO/LOCAL': dado.destino,
                    'OBSERVAÇÕES': dado.observacoes
                }));

                const ws = XLSX.utils.json_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Movimentacoes");

                const colWidths = [
                    {wch: 15}, // DATA MOVIMENTAÇÃO
                    {wch: 10}, // TIPO
                    {wch: 15}, // CT-e
                    {wch: 12}, // NF
                    {wch: 20}, // CLIENTE/FORNECEDOR
                    {wch: 20}, // PRODUTO
                    {wch: 12}, // QTDE PALLETS
                    {wch: 10}, // QTDE
                    {wch: 12}, // PESO NF
                    {wch: 12}, // LOTE
                    {wch: 15}, // DATA FABRICAÇÃO
                    {wch: 15}, // DATA VENCIMENTO
                    {wch: 20}, // MOTORISTA
                    {wch: 15}, // VALOR NF
                    {wch: 20}, // DESTINO/LOCAL
                    {wch: 25}  // OBSERVAÇÕES
                ];
                ws['!cols'] = colWidths;

                XLSX.writeFile(wb, "movimentacoes_transporte.xlsx");
            });

            // Exportar estoque geral para Excel
            $('#exportEstoqueGeralBtn').on('click', function() {
                if (estoque.length === 0) {
                    alert('Nenhum dado de estoque geral para exportar!');
                    return;
                }

                // Agrupar por produto para o estoque geral
                const estoqueAgrupado = {};
                estoque.forEach(item => {
                    const chave = `${item.produto}`;
                    if (!estoqueAgrupado[chave]) {
                        estoqueAgrupado[chave] = {
                            produto: item.produto,
                            totalQuantidade: 0,
                            lotes: new Set(),
                            datasVencimento: []
                        };
                    }
                    estoqueAgrupado[chave].totalQuantidade += item.quantidade;
                    estoqueAgrupado[chave].lotes.add(item.lote);
                    estoqueAgrupado[chave].datasVencimento.push(item.dataVencimento);
                });

                const wsData = Object.values(estoqueAgrupado).map(item => {
                    // Calcular status médio
                    let statusMedio = 'VÁLIDO';
                    const hoje = new Date();
                    
                    for (const dataVenc of item.datasVencimento) {
                        const vencimento = new Date(dataVenc);
                        const diffDays = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                            statusMedio = 'VENCIDO';
                            break;
                        } else if (diffDays <= 30) {
                            statusMedio = 'VENCE EM BREVE';
                        }
                    }
                    
                    return {
                        'PRODUTO': item.produto,
                        'LOTE TOTAL': `${item.lotes.size} lote(s)`,
                        'QUANTIDADE TOTAL': item.totalQuantidade,
                        'STATUS MÉDIO': statusMedio
                    };
                });

                const ws = XLSX.utils.json_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Estoque_Geral");

                const colWidths = [
                    {wch: 25}, // PRODUTO
                    {wch: 15}, // LOTE TOTAL
                    {wch: 18}, // QUANTIDADE TOTAL
                    {wch: 20}  // STATUS MÉDIO
                ];
                ws['!cols'] = colWidths;

                XLSX.writeFile(wb, "estoque_geral_transporte.xlsx");
            });

            // Carregar dados ao iniciar
            carregarDados();
            aplicarFiltros();
            atualizarTabelasEstoque();

            // Atualizar data atual nos campos relevantes
            const hoje = new Date().toISOString().split('T')[0];
            $('#dataMovimentacao').val(hoje);
            $('#dataFabricacao').val(hoje);
            $('#estoqueFabricacao').val(hoje);
            
            // Definir data de vencimento com 1 ano a partir de hoje como padrão
            const umAnoDepois = new Date();
            umAnoDepois.setFullYear(umAnoDepois.getFullYear() + 1);
            $('#dataVencimento').val(umAnoDepois.toISOString().split('T')[0]);
            $('#estoqueVencimento').val(umAnoDepois.toISOString().split('T')[0]);
        });
