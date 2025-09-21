using Microsoft.EntityFrameworkCore;
using APS.Compartilhado.Modelos.Entidades;

namespace APS.Infraestrutura.Dados.Contextos;

/// <summary>
/// Contexto principal do Entity Framework para a base de dados APS
/// </summary>
public class APSDbContext : DbContext
{
    public APSDbContext(DbContextOptions<APSDbContext> options) : base(options)
    {
    }

    // DbSets das entidades principais
    public DbSet<Estado> Estados { get; set; }
    public DbSet<Municipio> Municipios { get; set; }
    public DbSet<Hospital> Hospitais { get; set; }
    public DbSet<Medico> Medicos { get; set; }
    public DbSet<Paciente> Pacientes { get; set; }
    public DbSet<ClassificacaoCID10> ClassificacoesCID10 { get; set; }
    
    // DbSets das entidades de relacionamento
    public DbSet<MedicoHospital> MedicosHospitais { get; set; }
    public DbSet<EspecialidadeHospital> EspecialidadesHospitais { get; set; }
    public DbSet<DiagnosticoPaciente> DiagnosticosPacientes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configurações dos Estados
        modelBuilder.Entity<Estado>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Sigla).HasMaxLength(2).IsRequired();
            entity.Property(e => e.Nome).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Regiao).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => e.Sigla).IsUnique();
            entity.HasIndex(e => e.Nome).IsUnique();
        });

        // Configurações dos Municípios
        modelBuilder.Entity<Municipio>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Nome).HasMaxLength(100).IsRequired();
            entity.Property(e => e.CodigoIBGE).HasMaxLength(10).IsRequired();
            entity.Property(e => e.Latitude).HasColumnType("decimal(10,7)");
            entity.Property(e => e.Longitude).HasColumnType("decimal(10,7)");
            entity.HasIndex(e => e.CodigoIBGE).IsUnique();
            
            // Relacionamento com Estado
            entity.HasOne(m => m.Estado)
                  .WithMany(e => e.Municipios)
                  .HasForeignKey(m => m.EstadoId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Configurações dos Hospitais
        modelBuilder.Entity<Hospital>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Nome).HasMaxLength(200).IsRequired();
            entity.Property(e => e.CNES).HasMaxLength(20).IsRequired();
            entity.Property(e => e.CNPJ).HasMaxLength(20);
            entity.Property(e => e.Endereco).HasMaxLength(300).IsRequired();
            entity.Property(e => e.CEP).HasMaxLength(10);
            entity.Property(e => e.Telefone).HasMaxLength(20);
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.Latitude).HasColumnType("decimal(10,7)");
            entity.Property(e => e.Longitude).HasColumnType("decimal(10,7)");
            entity.Property(e => e.TipoEstabelecimento).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Natureza).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => e.CNES).IsUnique();
            entity.HasIndex(e => e.CNPJ).IsUnique().HasFilter("\"CNPJ\" IS NOT NULL");
            
            // Relacionamento com Município
            entity.HasOne(h => h.Municipio)
                  .WithMany(m => m.Hospitais)
                  .HasForeignKey(h => h.MunicipioId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Configurações dos Médicos
        modelBuilder.Entity<Medico>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Nome).HasMaxLength(100).IsRequired();
            entity.Property(e => e.CRM).HasMaxLength(20).IsRequired();
            entity.Property(e => e.EstadoCRM).HasMaxLength(2).IsRequired();
            entity.Property(e => e.CPF).HasMaxLength(15).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.Telefone).HasMaxLength(20);
            entity.Property(e => e.Especialidade).HasMaxLength(100).IsRequired();
            entity.Property(e => e.SubEspecialidade).HasMaxLength(100);
            entity.Property(e => e.SalarioBase).HasColumnType("decimal(10,2)");
            entity.Property(e => e.EnderecoResidencial).HasMaxLength(300);
            entity.Property(e => e.LatitudeResidencia).HasColumnType("decimal(10,7)");
            entity.Property(e => e.LongitudeResidencia).HasColumnType("decimal(10,7)");
            entity.HasIndex(e => new { e.CRM, e.EstadoCRM }).IsUnique();
            entity.HasIndex(e => e.CPF).IsUnique();
            
            // Relacionamento com Município de Residência
            entity.HasOne(m => m.MunicipioResidencia)
                  .WithMany(mu => mu.Medicos)
                  .HasForeignKey(m => m.MunicipioResidenciaId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Configurações dos Pacientes
        modelBuilder.Entity<Paciente>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Nome).HasMaxLength(100).IsRequired();
            entity.Property(e => e.CPF).HasMaxLength(15).IsRequired();
            entity.Property(e => e.RG).HasMaxLength(20);
            entity.Property(e => e.CartaoSUS).HasMaxLength(20);
            entity.Property(e => e.Sexo).HasMaxLength(1).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.Telefone).HasMaxLength(20);
            entity.Property(e => e.Endereco).HasMaxLength(300).IsRequired();
            entity.Property(e => e.CEP).HasMaxLength(10);
            entity.Property(e => e.Latitude).HasColumnType("decimal(10,7)");
            entity.Property(e => e.Longitude).HasColumnType("decimal(10,7)");
            entity.Property(e => e.TipoSanguineo).HasMaxLength(50);
            entity.Property(e => e.EstadoCivil).HasMaxLength(50);
            entity.Property(e => e.Profissao).HasMaxLength(100);
            entity.Property(e => e.StatusAtendimento).HasMaxLength(50);
            entity.Property(e => e.PrioridadeAtendimento).HasMaxLength(50);
            entity.HasIndex(e => e.CPF).IsUnique();
            entity.HasIndex(e => e.CartaoSUS).IsUnique().HasFilter("\"CartaoSUS\" IS NOT NULL");
            
            // Relacionamento com Município
            entity.HasOne(p => p.Municipio)
                  .WithMany(m => m.Pacientes)
                  .HasForeignKey(p => p.MunicipioId)
                  .OnDelete(DeleteBehavior.Restrict);
            
            // Relacionamento com Hospital Atual
            entity.HasOne(p => p.HospitalAtual)
                  .WithMany(h => h.Pacientes)
                  .HasForeignKey(p => p.HospitalAtualId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Configurações das Classificações CID-10
        modelBuilder.Entity<ClassificacaoCID10>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Codigo).HasMaxLength(10).IsRequired();
            entity.Property(e => e.Descricao).HasMaxLength(500).IsRequired();
            entity.Property(e => e.Categoria).HasMaxLength(100);
            entity.Property(e => e.Subcategoria).HasMaxLength(100);
            entity.Property(e => e.Sexo).HasMaxLength(50);
            entity.Property(e => e.FaixaEtaria).HasMaxLength(50);
            entity.Property(e => e.GrauSeveridade).HasMaxLength(50);
            entity.Property(e => e.EspecialidadeRecomendada).HasMaxLength(100);
            entity.HasIndex(e => e.Codigo).IsUnique();
        });

        // Configurações da relação Médico-Hospital
        modelBuilder.Entity<MedicoHospital>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TipoVinculo).HasMaxLength(50);
            entity.Property(e => e.CargaHorariaSemanal).HasColumnType("decimal(5,2)");
            entity.Property(e => e.Salario).HasColumnType("decimal(10,2)");
            entity.Property(e => e.Observacoes).HasMaxLength(100);
            entity.Property(e => e.DistanciaKm).HasColumnType("decimal(8,2)");
            entity.Property(e => e.ScoreAdequacao).HasColumnType("decimal(5,2)");
            
            // Índice único para evitar duplicatas
            entity.HasIndex(e => new { e.MedicoId, e.HospitalId, e.DataInicio }).IsUnique();
            
            // Relacionamentos
            entity.HasOne(mh => mh.Medico)
                  .WithMany(m => m.MedicosHospitais)
                  .HasForeignKey(mh => mh.MedicoId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(mh => mh.Hospital)
                  .WithMany(h => h.MedicosHospitais)
                  .HasForeignKey(mh => mh.HospitalId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Configurações das Especialidades do Hospital
        modelBuilder.Entity<EspecialidadeHospital>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Especialidade).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Observacoes).HasMaxLength(200);
            
            // Índice único para evitar duplicatas
            entity.HasIndex(e => new { e.HospitalId, e.Especialidade }).IsUnique();
            
            // Relacionamento
            entity.HasOne(eh => eh.Hospital)
                  .WithMany(h => h.EspecialidadesHospitais)
                  .HasForeignKey(eh => eh.HospitalId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Configurações dos Diagnósticos do Paciente
        modelBuilder.Entity<DiagnosticoPaciente>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TipoDiagnostico).HasMaxLength(50);
            entity.Property(e => e.Observacoes).HasMaxLength(1000);
            entity.Property(e => e.MedicoResponsavel).HasMaxLength(100);
            entity.Property(e => e.StatusDiagnostico).HasMaxLength(50);
            
            // Relacionamentos
            entity.HasOne(dp => dp.Paciente)
                  .WithMany(p => p.Diagnosticos)
                  .HasForeignKey(dp => dp.PacienteId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(dp => dp.ClassificacaoCID10)
                  .WithMany(cid => cid.DiagnosticosPacientes)
                  .HasForeignKey(dp => dp.ClassificacaoCID10Id)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Configurações adicionais de performance
        modelBuilder.Entity<Hospital>()
            .HasIndex(h => h.TipoEstabelecimento);
        
        modelBuilder.Entity<Hospital>()
            .HasIndex(h => h.Natureza);
        
        modelBuilder.Entity<Medico>()
            .HasIndex(m => m.Especialidade);
        
        modelBuilder.Entity<Paciente>()
            .HasIndex(p => p.StatusAtendimento);
        
        modelBuilder.Entity<Paciente>()
            .HasIndex(p => p.PrioridadeAtendimento);
        
        modelBuilder.Entity<ClassificacaoCID10>()
            .HasIndex(c => c.Categoria);
        
        modelBuilder.Entity<ClassificacaoCID10>()
            .HasIndex(c => c.EspecialidadeRecomendada);
    }
}
